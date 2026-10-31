"""Learning, knowledge, uploads."""
import io


def test_learning_text_pipeline(client, ollama_down):
    text = ("SQLite는 서버가 필요 없는 임베디드 데이터베이스이다. 파일 하나에 모든 데이터를 저장한다.\n\n"
            "SQLite는 트랜잭션을 지원하며 많은 모바일 앱에서 사용된다.")
    rec = client.post("/api/learning/text", json={"text": text, "title": "SQLite", "category": "db"}).json()
    r = client.get(f"/api/learning/records/{rec['id']}").json()
    assert r["status"] == "completed" and r["method"] == "extractive"  # no AI -> labelled extractive
    assert r["added"] >= 1 and r["knowledge"] and r["key_points"]
    # same material again -> duplicate, nothing added
    rec2 = client.post("/api/learning/text", json={"text": text, "title": "SQLite again"}).json()
    r2 = client.get(f"/api/learning/records/{rec2['id']}").json()
    assert r2["added"] == 0 and r2["duplicates"] == r["chunks_total"]
    assert r2["comparison"][0]["result"] == "duplicate"


def test_learning_with_ai_compares_related(client):
    client.post("/api/learning/text", json={"text": "Rust는 메모리 안전성을 보장하는 시스템 프로그래밍 언어이다. 소유권 개념을 사용한다.", "title": "Rust"})
    rec = client.post("/api/learning/text", json={"text": "Rust는 메모리 안전성을 보장하는 언어이며 2015년에 1.0이 나왔다. 소유권 개념이 핵심이다.", "title": "Rust 역사"}).json()
    r = client.get(f"/api/learning/records/{rec['id']}").json()
    assert r["method"] == "llm" and r["summary"].startswith("[TEST DOUBLE]")
    assert r["related"] >= 1
    rel = [c for c in r["comparison"] if c["result"] == "related"][0]
    assert rel["relation"] == "adds"


def test_learning_rejects_short_text(client):
    assert client.post("/api/learning/text", json={"text": "짧음"}).status_code == 422


def test_upload_txt_and_limits(client):
    data = "Docker 컨테이너는 애플리케이션을 격리된 환경에서 실행한다. 이미지로부터 만들어진다.".encode()
    r = client.post("/api/learning/file", files={"file": ("../../etc/notes.txt", io.BytesIO(data), "text/plain")})
    assert r.status_code == 200
    rec = r.json()
    assert rec["source_name"] == "notes.txt"  # path stripped
    assert client.get(f"/api/learning/records/{rec['id']}").json()["status"] == "completed"
    bad = client.post("/api/learning/file", files={"file": ("run.exe", io.BytesIO(b"MZ..."), "application/octet-stream")})
    assert bad.status_code == 422 and "지원하지 않는" in bad.json()["detail"]
    big = client.post("/api/learning/file", files={"file": ("big.txt", io.BytesIO(b"a" * (5 * 1024 * 1024 + 10)), "text/plain")})
    assert big.status_code == 422 and "너무 큽니다" in big.json()["detail"]
    fake_pdf = client.post("/api/learning/file", files={"file": ("x.pdf", io.BytesIO(b"hello"), "application/pdf")})
    assert fake_pdf.status_code == 422
    binary = client.post("/api/learning/file", files={"file": ("x.txt", io.BytesIO(b"ab\x00cd" * 10), "text/plain")})
    assert binary.status_code == 422


def test_upload_pdf(client):
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
    w = PdfWriter()
    page = w.add_blank_page(300, 300)
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 20 200 Td (Kubernetes orchestrates containers across many machines.) Tj ET")
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): w._add_object(font)})})
    page[NameObject("/Contents")] = w._add_object(stream)
    buf = io.BytesIO()
    w.write(buf)
    r = client.post("/api/learning/file", files={"file": ("k8s.pdf", io.BytesIO(buf.getvalue()), "application/pdf")})
    assert r.status_code == 200, r.text
    rec = client.get(f"/api/learning/records/{r.json()['id']}").json()
    assert rec["status"] == "completed"
    hits = client.get("/api/knowledge", params={"q": "Kubernetes"}).json()
    assert hits and "Kubernetes" in hits[0]["content"]


def test_knowledge_search_edit_verify_delete(client):
    client.post("/api/learning/text", json={"text": "광합성은 식물이 빛 에너지로 포도당을 만드는 과정이다. 엽록체에서 일어난다.", "title": "광합성", "category": "biology"})
    client.post("/api/learning/text", json={"text": "블랙홀은 빛조차 빠져나올 수 없는 천체이다. 사건의 지평선을 가진다.", "title": "블랙홀", "category": "space"})
    hits = client.get("/api/knowledge", params={"q": "광합성은 어디서 일어나"}).json()
    assert hits[0]["title"] == "광합성"
    cats = {c["category"] for c in client.get("/api/knowledge/categories").json()}
    assert {"biology", "space"} <= cats or "test" in cats
    kid = hits[0]["id"]
    k = client.patch(f"/api/knowledge/{kid}", json={"verification": "user_verified"}).json()
    assert k["verification"] == "user_verified" and k["confidence"] >= 0.9
    assert client.patch(f"/api/knowledge/{kid}", json={"verification": "true!"}).status_code == 422
    assert len(client.get("/api/knowledge", params={"verification": "user_verified"}).json()) == 1
    assert client.delete(f"/api/knowledge/{kid}").status_code == 200
    assert client.get(f"/api/knowledge/{kid}").status_code == 404


def test_delete_learning_record_with_knowledge(client, ollama_down):
    rec = client.post("/api/learning/text", json={"text": "테스트 자료입니다. 이 문장은 삭제 테스트를 위한 문장입니다."}).json()
    assert client.get("/api/knowledge").json()
    r = client.delete(f"/api/learning/records/{rec['id']}", params={"delete_knowledge": True}).json()
    assert r["knowledge_deleted"] >= 1 and client.get("/api/knowledge").json() == []
