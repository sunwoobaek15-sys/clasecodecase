/* SAVE CITY — SAVE 화면 (기획서 7, 8, 9) + 기록 수정 화면 */
(function (root) {
  'use strict';
  const SC = root.SC;
  const U = SC.util;
  const D = SC.data;
  const E = SC.engine;
  const ui = SC.ui;
  const V = SC.view;
  const app = SC.app;
  const R = D.RULES;

  let busy = false;
  let existingUrl = null;

  function newDraft() {
    return { item: '', amount: '', reason: '', memo: '', category: null, image: null, imageUrl: null };
  }

  function editDraftFor(rec) {
    return {
      id: rec.id,
      item: rec.item,
      amount: U.fmt(rec.amount),
      reason: rec.reason,
      memo: rec.memo,
      category: rec.category,
      image: null,
      imageUrl: null,
      imageMode: rec.hasImage ? 'keep' : 'none',
    };
  }

  function draftOf(mode) {
    return mode === 'edit' ? app.view.editDraft : app.view.saveDraft;
  }

  /* ---------------- 그리기 ---------------- */

  function photoBox(draft, mode) {
    const usable = SC.images.usable !== false;
    let inner;
    if (draft.imageUrl) {
      inner = '<figure class="photo-preview"><img src="' + draft.imageUrl + '" alt="첨부할 사진 미리보기"><button type="button" class="icon-btn photo-remove" data-action="save:photoRemove" aria-label="사진 빼기">' + ui.icon('close') + '</button></figure>';
    } else if (mode === 'edit' && draft.imageMode === 'keep') {
      inner = '<figure class="photo-preview"><img id="existing-photo" alt="기록에 저장된 사진"><button type="button" class="icon-btn photo-remove" data-action="save:photoRemove" aria-label="사진 빼기">' + ui.icon('close') + '</button></figure>';
    } else {
      inner = usable
        ? '<button type="button" class="photo-add" data-action="save:photoPick">' + ui.icon('image') + '<span>사진 추가</span><small>영수증이나 참은 물건 사진</small></button>'
        : '<p class="muted small">이 브라우저에서는 사진을 저장할 수 없어요. 사진 없이도 기록할 수 있어요.</p>';
    }
    return '<div class="photo-box" id="photo-box">' + inner + '</div>' + '<p class="field-error" id="e-photo" hidden></p>';
  }

  function formHtml(draft, mode, ctx) {
    const isEdit = mode === 'edit';
    const catChips = D.CATEGORIES.map(
      (c) => '<button type="button" class="pick' + (draft.category === c.id ? ' on' : '') + '" role="radio" aria-checked="' + (draft.category === c.id) + '" data-action="save:cat" data-cat="' + c.id + '">' + c.icon + ' ' + c.label + '</button>'
    ).join('');
    const reasonChips = D.REASON_CHIPS.map((r) => '<button type="button" class="pick pick-soft" data-action="save:reason" data-reason="' + U.esc(r) + '">' + U.esc(r) + '</button>').join('');
    return (
      '<form class="card save-form" id="save-form" novalidate data-mode="' + mode + '">' +
      '<div class="field">' +
      '<label for="f-item">무엇을 절약했나요?</label>' +
      '<input class="input" id="f-item" name="item" maxlength="' + R.ITEM_MAX + '" placeholder="예: 후드티" autocomplete="off" value="' + U.esc(draft.item) + '" aria-describedby="e-item">' +
      '<p class="field-error" id="e-item" hidden></p>' +
      '<div class="chip-row wrap" role="radiogroup" aria-label="종류 (선택)">' + catChips + '</div>' +
      '<p class="hint small" id="cat-guess"></p>' +
      '</div>' +
      '<div class="field">' +
      '<label for="f-amount">얼마를 절약했나요?</label>' +
      '<div class="money-input"><span aria-hidden="true">₩</span><input class="input" id="f-amount" name="amount" inputmode="numeric" enterkeyhint="next" placeholder="예: 49,000" autocomplete="off" value="' + U.esc(draft.amount) + '" aria-describedby="e-amount"><span class="unit" aria-hidden="true">원</span></div>' +
      '<p class="field-error" id="e-amount" hidden></p>' +
      '<div class="chip-row wrap">' +
      [1000, 5000, 10000, 50000].map((v) => '<button type="button" class="pick pick-amount" data-action="save:add" data-v="' + v + '">+' + (v >= 10000 ? v / 10000 + '만' : v / 1000 + '천') + '</button>').join('') +
      '<button type="button" class="pick pick-ghost" data-action="save:clearAmount">지우기</button>' +
      '</div>' +
      '</div>' +
      '<div class="field">' +
      '<label for="f-reason">왜 구매하지 않았나요?</label>' +
      '<input class="input" id="f-reason" name="reason" maxlength="' + R.REASON_MAX + '" placeholder="예: 이미 비슷한 옷이 있음" autocomplete="off" value="' + U.esc(draft.reason) + '" aria-describedby="e-reason">' +
      '<p class="field-error" id="e-reason" hidden></p>' +
      '<div class="chip-row wrap">' + reasonChips + '</div>' +
      '</div>' +
      '<div class="field">' +
      '<label for="f-memo">메모 <span class="opt">(선택)</span></label>' +
      '<textarea class="input" id="f-memo" name="memo" maxlength="' + R.MEMO_MAX + '" rows="3" placeholder="예: 다음 달까지는 새 옷을 사지 않기로 함">' + U.esc(draft.memo) + '</textarea>' +
      '<p class="counter"><span id="memo-count">' + Array.from(draft.memo || '').length + '</span>/' + R.MEMO_MAX + '</p>' +
      '</div>' +
      '<div class="field">' +
      '<span class="label">이미지 <span class="opt">(선택)</span></span>' +
      photoBox(draft, mode) +
      '<input type="file" id="f-photo" accept="image/*" hidden>' +
      '</div>' +
      '<div class="reward-preview" aria-live="polite">' +
      '<h2 class="sub">' + (isEdit ? '수정 후 예상 보상' : '절약 완료 전 예상 보상') + '</h2>' +
      '<div class="reward-grid">' +
      '<div><span>절약 금액</span><strong id="pv-amount">₩0</strong></div>' +
      '<div><span>인정 금액</span><strong id="pv-rec">₩0</strong></div>' +
      '<div class="pv-token"><span>획득 TOKEN</span><strong id="pv-token">+0</strong></div>' +
      '</div>' +
      '<div class="daily-bar" id="pv-daily"></div>' +
      '<p class="pv-note" id="pv-note"></p>' +
      '</div>' +
      (isEdit
        ? '<div class="form-actions"><button type="button" class="btn btn-secondary" data-nav="record" data-param="' + draft.id + '">취소</button><button type="submit" class="btn btn-primary" id="save-submit">저장하기</button></div>'
        : '<button type="submit" class="btn btn-primary btn-xl btn-block" id="save-submit">' + ui.icon('check') + '확인</button>') +
      '</form>'
    );
  }

  function renderNew(ctx) {
    const { state, d } = ctx;
    if (!app.view.saveDraft) app.view.saveDraft = newDraft();
    const draft = app.view.saveDraft;
    let html = V.pageHead('절약 기록하기', '사지 않고 참은 돈을 기록하면 TOKEN을 받아요. <b>1,000원 = 10 TOKEN</b>, 하루 최대 50,000원까지 인정돼요.');
    html +=
      '<section class="card quick" aria-labelledby="quick-h"><h2 class="sub" id="quick-h">빠른 입력 예시</h2><div class="chip-row scroll-x">' +
      D.EXAMPLES.map((ex, i) => '<button type="button" class="pick pick-example" data-action="save:example" data-i="' + i + '"><span aria-hidden="true">' + V.catIcon(ex.category) + '</span> ' + ex.item + ' <b>' + U.won(ex.amount) + '</b></button>').join('') +
      '</div></section>';
    html += formHtml(draft, 'new', ctx);
    html += '<section class="card checkin-card" aria-labelledby="ci-h"><h2 class="sub" id="ci-h">오늘은 절약한 게 없나요?</h2>';
    if (d.streak.recordedToday) {
      html += '<p class="ok-line">✓ 오늘은 이미 기록했어요. STREAK ' + d.streak.current + '일째 유지 중!</p>';
    } else {
      html += '<p class="muted">0원으로 오늘을 기록하면 STREAK이 끊기지 않아요. TOKEN은 받지 않아요.</p><button type="button" class="btn btn-secondary btn-block" data-action="save:checkin">🗓️ 0원으로 오늘 기록하기</button>';
    }
    html += '</section>';
    html += '<p class="fineprint">TOKEN은 게임 속 포인트예요. 실제 돈이 아니며 돈으로 바꿀 수 없어요. 앱은 실제 절약 여부를 확인하지 않아요. 스스로에게 솔직하게 기록해 주세요.</p>';
    return html;
  }

  function renderEdit(ctx) {
    const rec = ctx.state.history.find((r) => r.id === ctx.param);
    if (!rec) {
      return V.pageHead('기록 수정', '', { back: 'history' }) + V.empty('🔍', '기록을 찾을 수 없어요', '이미 삭제되었을 수 있어요.', '<button type="button" class="btn btn-primary" data-nav="history">기록 목록으로</button>');
    }
    if (rec.kind === 'checkin') {
      return V.pageHead('기록 수정', '', { back: 'record', backParam: rec.id }) + V.empty('🗓️', '0원 기록은 수정할 수 없어요', '필요하면 기록 상세에서 삭제할 수 있어요.', '<button type="button" class="btn btn-primary" data-nav="record" data-param="' + rec.id + '">기록 상세로</button>');
    }
    if (!app.view.editDraft || app.view.editDraft.id !== rec.id) app.view.editDraft = editDraftFor(rec);
    return V.pageHead('기록 수정', V.dayLabel(rec.date) + ' 기록 · 날짜는 바꿀 수 없어요', { back: 'record', backParam: rec.id }) + formHtml(app.view.editDraft, 'edit', ctx);
  }

  /* ---------------- 입력 처리 ---------------- */

  function formatAmountInput(input) {
    const raw = input.value;
    if (!/^[\d,\s]*$/.test(raw)) return;
    const caret = input.selectionStart == null ? raw.length : input.selectionStart;
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length;
    const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (formatted === raw) return;
    input.value = formatted;
    let pos = 0;
    let count = 0;
    while (pos < formatted.length && count < digitsBefore) {
      if (/\d/.test(formatted[pos])) count++;
      pos++;
    }
    try {
      if (document.activeElement === input) input.setSelectionRange(pos, pos);
    } catch (e) {
      /* 일부 입력 형식은 커서 이동을 지원하지 않음 */
    }
  }

  function setError(rootEl, field, msg) {
    const p = rootEl.querySelector('#e-' + field);
    const input = rootEl.querySelector('#f-' + field);
    if (p) {
      p.textContent = msg || '';
      p.hidden = !msg;
    }
    if (input) {
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function showErrors(rootEl, errors) {
    let first = null;
    for (const f of ['item', 'amount', 'reason']) {
      setError(rootEl, f, errors[f]);
      if (errors[f] && !first) first = f;
    }
    if (first) {
      const el = rootEl.querySelector('#f-' + first);
      if (el) {
        el.focus();
        el.scrollIntoView({ block: 'center', behavior: document.documentElement.classList.contains('no-anim') ? 'auto' : 'smooth' });
      }
    }
  }

  function updateGuess(rootEl, draft) {
    const el = rootEl.querySelector('#cat-guess');
    if (!el) return;
    const item = U.cleanText(draft.item, R.ITEM_MAX);
    if (draft.category || !item) {
      el.textContent = '';
      return;
    }
    const g = E.guessCategory(item);
    el.textContent = '종류를 고르지 않으면 자동으로 ' + V.catIcon(g) + ' ' + U.ro(V.catLabel(g)) + ' 기록돼요.';
  }

  function updatePreview(rootEl, mode) {
    const draft = draftOf(mode);
    const state = app.state;
    const $ = (s) => rootEl.querySelector(s);
    if (!$('#pv-amount')) return;
    const note = $('#pv-note');
    const daily = $('#pv-daily');
    const hasInput = String(draft.amount || '').trim() !== '';
    note.className = 'pv-note';
    let pv;
    let used;
    if (mode === 'edit') {
      const rec = state.history.find((r) => r.id === draft.id);
      if (!rec) return;
      pv = E.previewEdit(state, draft.id, draft.amount);
      used = pv.ok ? pv.othersRecognized : E.dayRecognized(state, rec.date) - rec.recognized;
      if (pv.ok) {
        $('#pv-amount').textContent = U.won(pv.amount);
        $('#pv-rec').textContent = U.won(pv.recognized);
        $('#pv-token').textContent = '+' + U.fmt(pv.tokens);
        let txt = '기존 +' + U.fmt(pv.oldTokens) + ' → 수정 후 +' + U.fmt(pv.tokens) + ' TOKEN';
        if (pv.delta) txt += ' (보유 TOKEN ' + U.signed(pv.delta) + ')';
        if (pv.balanceAfter < 0) {
          note.className = 'pv-note warn';
          txt += ' · 이미 사용한 TOKEN이 있어서 이만큼 줄일 수 없어요. ' + U.fmt(-pv.balanceAfter) + '개가 부족해요.';
        } else if (pv.capped) txt += ' · 그날의 인정 한도(50,000원)를 넘은 부분은 TOKEN이 되지 않아요.';
        note.textContent = txt;
      }
    } else {
      pv = E.previewSave(state, draft.amount, new Date());
      used = pv.used;
      if (pv.ok) {
        $('#pv-amount').textContent = U.won(pv.amount);
        $('#pv-rec').textContent = U.won(pv.recognized);
        $('#pv-token').textContent = '+' + U.fmt(pv.tokens);
        if (pv.remaining === 0) {
          note.className = 'pv-note warn';
          note.textContent = '오늘은 인정 금액 50,000원을 모두 채웠어요. 기록은 남길 수 있지만 TOKEN은 내일 다시 받을 수 있어요.';
        } else if (pv.capped) {
          note.className = 'pv-note warn';
          note.textContent = '하루 최대 인정 금액은 50,000원이에요. ' + U.won(pv.amount) + ' 중 ' + U.won(pv.recognized) + '만 인정돼요.';
        } else if (pv.tokens === 0) {
          note.textContent = '1,000원 미만은 TOKEN이 없어요. 그래도 기록과 STREAK은 인정돼요.';
        } else {
          note.textContent = '1,000원마다 10 TOKEN을 받아요. 1,000원 미만 금액은 TOKEN으로 바뀌지 않아요.';
        }
      }
    }
    if (!pv.ok) {
      $('#pv-amount').textContent = '₩0';
      $('#pv-rec').textContent = '₩0';
      $('#pv-token').textContent = '+0';
      if (hasInput) {
        note.className = 'pv-note error';
        note.textContent = pv.message;
      } else {
        note.textContent = '금액을 입력하면 받을 TOKEN을 미리 보여 드려요.';
      }
    }
    const rec = pv.ok ? pv.recognized : 0;
    const cap = R.DAILY_CAP;
    daily.innerHTML =
      '<div class="stack-bar" aria-hidden="true"><span class="sb-used" style="width:' + ((used / cap) * 100).toFixed(1) + '%"></span><span class="sb-new" style="width:' + ((rec / cap) * 100).toFixed(1) + '%"></span></div>' +
      '<p class="small muted">' + (mode === 'edit' ? '그날' : '오늘') + ' 인정 금액 ' + U.won(used + rec) + ' / ' + U.won(cap) + ' · 남은 인정 금액 ' + U.won(Math.max(0, cap - used - rec)) + '</p>';
  }

  function syncPhoto(rootEl, mode) {
    const draft = draftOf(mode);
    const box = rootEl.querySelector('#photo-box');
    if (!box) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = photoBox(draft, mode);
    box.replaceWith(tmp.firstElementChild);
    const err = rootEl.querySelector('#e-photo');
    if (err) err.hidden = true;
    loadExisting(rootEl, mode);
  }

  function loadExisting(rootEl, mode) {
    const img = rootEl.querySelector('#existing-photo');
    if (!img || mode !== 'edit') return;
    const id = app.view.editDraft.id;
    SC.images
      .get(id)
      .then((blob) => {
        if (!blob || !img.isConnected) {
          if (img.isConnected) img.closest('figure').innerHTML = '<p class="muted small">사진을 불러올 수 없어요.</p>';
          return;
        }
        if (existingUrl) URL.revokeObjectURL(existingUrl);
        existingUrl = URL.createObjectURL(blob);
        img.src = existingUrl;
      })
      .catch(() => {
        if (img.isConnected) img.closest('figure').innerHTML = '<p class="muted small">사진을 불러올 수 없어요.</p>';
      });
  }

  function mountForm(rootEl, mode) {
    const form = rootEl.querySelector('#save-form');
    if (!form) return;
    const draft = draftOf(mode);
    const fItem = form.querySelector('#f-item');
    const fAmount = form.querySelector('#f-amount');
    const fReason = form.querySelector('#f-reason');
    const fMemo = form.querySelector('#f-memo');
    const fPhoto = form.querySelector('#f-photo');

    fItem.addEventListener('input', () => {
      draft.item = fItem.value;
      setError(rootEl, 'item', '');
      updateGuess(rootEl, draft);
    });
    fAmount.addEventListener('input', () => {
      formatAmountInput(fAmount);
      draft.amount = fAmount.value;
      setError(rootEl, 'amount', '');
      updatePreview(rootEl, mode);
    });
    fReason.addEventListener('input', () => {
      draft.reason = fReason.value;
      setError(rootEl, 'reason', '');
    });
    fMemo.addEventListener('input', () => {
      draft.memo = fMemo.value;
      const c = rootEl.querySelector('#memo-count');
      if (c) c.textContent = Array.from(fMemo.value).length;
    });
    fPhoto.addEventListener('change', () => {
      const file = fPhoto.files && fPhoto.files[0];
      fPhoto.value = '';
      if (!file) return;
      const err = rootEl.querySelector('#e-photo');
      SC.resizeImage(file)
        .then((blob) => {
          if (draft.imageUrl) URL.revokeObjectURL(draft.imageUrl);
          draft.image = blob;
          draft.imageUrl = URL.createObjectURL(blob);
          if (mode === 'edit') draft.imageMode = 'new';
          syncPhoto(rootEl, mode);
        })
        .catch((e) => {
          const msg =
            e && e.message === 'type'
              ? '이미지 파일만 올릴 수 있어요.'
              : e && e.message === 'size'
                ? '사진이 너무 커요. 25MB 이하 사진을 골라 주세요.'
                : '이 사진은 열 수 없어요. JPG나 PNG 사진으로 다시 시도해 주세요.';
          if (err) {
            err.textContent = msg;
            err.hidden = false;
          }
          SC.audio.play('error');
        });
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (mode === 'edit') submitEdit(rootEl);
      else submitNew(rootEl);
    });
    // Enter 키로 다음 칸 이동 (모바일 키보드 편의)
    [fItem, fAmount].forEach((el, i) =>
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          (i === 0 ? fAmount : fReason).focus();
        }
      })
    );
    updateGuess(rootEl, draft);
    updatePreview(rootEl, mode);
    loadExisting(rootEl, mode);
  }

  /* ---------------- 저장 ---------------- */

  function rewardLines(res, d) {
    let html = '';
    html += '<p class="result-line">🔥 STREAK <b>' + d.streak.current + '일</b> 연속!' + (d.streak.current >= 2 ? '' : ' 내일도 기록하면 2일이 돼요.') + '</p>';
    res.events
      .filter((e) => e.type === 'streakReward')
      .forEach((s) => (html += '<p class="result-line reward">🎁 <b>' + s.days + '일 연속 보상</b> ' + V.rewardText(s.reward) + '</p>'));
    res.events.filter((e) => e.type === 'achievement').forEach((a) => (html += app.achLine(a)));
    return html;
  }

  function showResult(res) {
    const d = app.d;
    const r = res.record;
    SC.audio.play(res.tokens > 0 ? 'coin' : 'success');
    if (res.tokens > 0) ui.confetti(70);
    let notes = '';
    if (res.capped && res.recognized > 0) notes = '<p class="result-note">하루 최대 인정 금액(50,000원)까지만 TOKEN으로 바뀌었어요.</p>';
    else if (res.capped) notes = '<p class="result-note">오늘은 인정 금액을 모두 채워서 TOKEN이 없어요. 기록과 STREAK은 남았어요!</p>';
    else if (!res.tokens) notes = '<p class="result-note">1,000원 미만이라 TOKEN은 없지만, 기록과 STREAK은 인정돼요!</p>';
    const body =
      '<div class="result-card">' +
      '<div class="result-coin" aria-hidden="true">' + ui.coin('coin-xl') + '</div>' +
      '<p class="result-amount">' + U.fmt(r.amount) + '원 절약!</p>' +
      '<p class="result-token">+<span id="result-token-n">0</span> TOKEN</p>' +
      '<p class="result-sub">절약 기록 성공!</p>' +
      '</div>' +
      notes +
      (res.bonusOffered ? '<div class="bonus-box"><p class="bonus-intro"><b>오늘의 첫 기록 보너스!</b> 하나를 골라 주세요.</p>' + app.bonusChoicesHtml() + '<p class="small muted center box-note">지금 고르지 않아도 홈 화면에서 받을 수 있어요.</p></div>' : '') +
      '<div class="result-lines">' + rewardLines(res, d) + '</div>';
    ui.open({
      title: '절약 기록 성공!',
      className: 'dialog-result',
      body,
      actions: [
        { label: '도시 꾸미러 가기', kind: 'secondary', onClick: () => app.navigate('city') },
        { label: '확인', kind: 'primary', onClick: () => app.navigate('home') },
      ],
      onOpen: (el) => ui.countUp(el.querySelector('#result-token-n'), 0, res.tokens, 800),
      onClose: () => setTimeout(() => app.celebrate(res.events, { skipAchievements: true, skipStreak: true }), 60),
    });
  }

  async function submitNew(rootEl) {
    if (busy) return;
    const draft = app.view.saveDraft;
    try {
      E.validateRecordInput(draft);
    } catch (e) {
      if (e.code === 'invalid') {
        showErrors(rootEl, e.info.errors);
        SC.audio.play('error');
        return;
      }
      throw e;
    }
    busy = true;
    const btn = rootEl.querySelector('#save-submit');
    if (btn) btn.disabled = true;
    const id = U.uid('r');
    let hasImage = false;
    if (draft.image) {
      try {
        await SC.images.put(id, draft.image);
        hasImage = true;
      } catch (e) {
        ui.toast('사진은 저장하지 못했어요. 기록은 사진 없이 저장할게요.', { type: 'error' });
      }
    }
    const res = app.commit((s, now) => E.addRecord(s, Object.assign({}, draft, { id, hasImage }), now), { render: false });
    busy = false;
    if (btn) btn.disabled = false;
    if (!res) {
      if (hasImage) SC.images.del(id);
      return;
    }
    if (draft.imageUrl) URL.revokeObjectURL(draft.imageUrl);
    app.view.saveDraft = newDraft();
    app.render();
    showResult(res);
  }

  async function submitEdit(rootEl) {
    if (busy) return;
    const draft = app.view.editDraft;
    const rec = app.state.history.find((r) => r.id === draft.id);
    if (!rec) {
      ui.toast('기록을 찾을 수 없어요.', { type: 'error' });
      app.navigate('history');
      return;
    }
    try {
      E.validateRecordInput(draft);
    } catch (e) {
      if (e.code === 'invalid') {
        showErrors(rootEl, e.info.errors);
        SC.audio.play('error');
        return;
      }
      throw e;
    }
    busy = true;
    const hadImage = rec.hasImage;
    const hasImage = draft.imageMode === 'new' ? true : draft.imageMode === 'remove' ? false : rec.hasImage;
    const res = app.commit((s, now) => E.updateRecord(s, draft.id, Object.assign({}, draft, { hasImage }), now), { render: false });
    if (!res) {
      busy = false;
      return;
    }
    const id = draft.id;
    if (draft.imageMode === 'new' && draft.image) {
      try {
        await SC.images.put(id, draft.image);
      } catch (e) {
        app.commit((s, now) => E.setRecordImage(s, id, hadImage, now), { render: false });
        ui.toast('새 사진은 저장하지 못했어요.' + (hadImage ? ' 원래 사진은 그대로 남아 있어요.' : ''), { type: 'error' });
      }
    } else if (draft.imageMode === 'remove') {
      SC.images.del(id);
    }
    busy = false;
    if (draft.imageUrl) URL.revokeObjectURL(draft.imageUrl);
    app.view.editDraft = null;
    SC.audio.play('success');
    ui.toast('기록을 수정했어요.' + (res.delta ? ' TOKEN ' + U.signed(res.delta) : ''), { type: 'success', icon: '✏️' });
    app.navigate('record', id, { replace: true });
    if (res.bonusOffered) {
      ui.toast('<b>기록 보너스</b>를 받을 수 있어요!', { type: 'success', icon: '🎁', action: { label: '받기', onClick: () => app.openBonus() } });
    }
    app.celebrate(res.events);
  }

  /* ---------------- 버튼 ---------------- */

  function currentMode() {
    return app.route.name === 'edit' ? 'edit' : 'new';
  }
  function mainEl() {
    return document.getElementById('screen');
  }

  app.actions['save:example'] = (btn) => {
    const ex = D.EXAMPLES[Number(btn.dataset.i)];
    if (!ex) return;
    const draft = app.view.saveDraft;
    Object.assign(draft, { item: ex.item, amount: U.fmt(ex.amount), reason: ex.reason, category: ex.category });
    SC.audio.play('tap');
    app.render();
    const submit = mainEl().querySelector('#save-submit');
    if (submit) submit.scrollIntoView({ block: 'center', behavior: document.documentElement.classList.contains('no-anim') ? 'auto' : 'smooth' });
  };

  app.actions['save:cat'] = (btn) => {
    const mode = currentMode();
    const draft = draftOf(mode);
    draft.category = draft.category === btn.dataset.cat ? null : btn.dataset.cat;
    const rootEl = mainEl();
    rootEl.querySelectorAll('[data-action="save:cat"]').forEach((b) => {
      const on = b.dataset.cat === draft.category;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    updateGuess(rootEl, draft);
    SC.audio.play('toggle');
  };

  app.actions['save:reason'] = (btn) => {
    const mode = currentMode();
    const draft = draftOf(mode);
    draft.reason = btn.dataset.reason;
    const el = mainEl().querySelector('#f-reason');
    if (el) el.value = draft.reason;
    setError(mainEl(), 'reason', '');
    SC.audio.play('toggle');
  };

  app.actions['save:add'] = (btn) => {
    const mode = currentMode();
    const draft = draftOf(mode);
    const p = E.parseAmount(draft.amount);
    const base = p.ok ? p.value : 0;
    const next = Math.min(R.MAX_INPUT, base + Number(btn.dataset.v));
    draft.amount = U.fmt(next);
    const el = mainEl().querySelector('#f-amount');
    if (el) el.value = draft.amount;
    setError(mainEl(), 'amount', '');
    updatePreview(mainEl(), mode);
    SC.audio.play('tap');
  };

  app.actions['save:clearAmount'] = () => {
    const mode = currentMode();
    draftOf(mode).amount = '';
    const el = mainEl().querySelector('#f-amount');
    if (el) {
      el.value = '';
      el.focus();
    }
    updatePreview(mainEl(), mode);
  };

  app.actions['save:photoPick'] = () => {
    const input = mainEl().querySelector('#f-photo');
    if (input) input.click();
  };

  app.actions['save:photoRemove'] = () => {
    const mode = currentMode();
    const draft = draftOf(mode);
    if (draft.imageUrl) URL.revokeObjectURL(draft.imageUrl);
    draft.image = null;
    draft.imageUrl = null;
    if (mode === 'edit') {
      const rec = app.state.history.find((r) => r.id === draft.id);
      draft.imageMode = rec && rec.hasImage ? 'remove' : 'none';
    }
    syncPhoto(mainEl(), mode);
    SC.audio.play('tap');
  };

  app.actions['save:checkin'] = () => {
    const res = app.commit((s, now) => E.addCheckin(s, now));
    if (!res) return;
    const d = app.d;
    SC.audio.play('success');
    ui.open({
      title: '오늘 기록 완료!',
      className: 'dialog-result',
      body:
        '<div class="result-card result-checkin"><div class="result-coin" aria-hidden="true">🗓️</div><p class="result-amount">0원 기록 완료</p><p class="result-token">🔥 ' + d.streak.current + '일 연속</p><p class="result-sub">STREAK을 지켰어요. 내일은 절약해 봐요!</p></div>' +
        '<div class="result-lines">' +
        res.events.filter((e) => e.type === 'streakReward').map((s) => '<p class="result-line reward">🎁 <b>' + s.days + '일 연속 보상</b> ' + V.rewardText(s.reward) + '</p>').join('') +
        res.events.filter((e) => e.type === 'achievement').map(app.achLine).join('') +
        '</div>',
      actions: [{ label: '확인', kind: 'primary', onClick: () => app.navigate('home') }],
      onClose: () => setTimeout(() => app.celebrate(res.events, { skipAchievements: true, skipStreak: true }), 60),
    });
  };

  SC.screens.save = {
    title: () => '절약 기록하기',
    render: renderNew,
    mount(rootEl) {
      mountForm(rootEl, 'new');
    },
    onImagesReady() {
      const rootEl = mainEl();
      if (rootEl.querySelector('#photo-box') && SC.images.usable === false) syncPhoto(rootEl, 'new');
    },
  };

  SC.screens.edit = {
    title: () => '기록 수정',
    render: renderEdit,
    mount(rootEl) {
      mountForm(rootEl, 'edit');
    },
    unmount() {
      if (existingUrl) URL.revokeObjectURL(existingUrl);
      existingUrl = null;
    },
    onImagesReady() {
      const rootEl = mainEl();
      if (rootEl.querySelector('#photo-box')) syncPhoto(rootEl, 'edit');
    },
  };
})(window);
