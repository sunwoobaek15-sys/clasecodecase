# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.jarvis.assistant.**$$serializer { *; }
-keepclassmembers class com.jarvis.assistant.** { *** Companion; }
-keepclasseswithmembers class com.jarvis.assistant.** { kotlinx.serialization.KSerializer serializer(...); }

# Vosk / JNA
-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }
-keep class org.vosk.** { *; }
-dontwarn java.awt.**

# OkHttp
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Anthropic Java SDK (Jackson 리플렉션 기반 직렬화)
-keep class com.anthropic.** { *; }
-keep class com.fasterxml.jackson.** { *; }
-keepattributes Signature, EnclosingMethod, *Annotation*
-dontwarn com.fasterxml.jackson.databind.ext.**
-dontwarn java.beans.**
-dontwarn javax.annotation.**
-dontwarn org.apache.hc.**
-dontwarn com.github.victools.**
-dontwarn io.swagger.**
-dontwarn org.slf4j.**
-dontwarn com.google.errorprone.annotations.**
