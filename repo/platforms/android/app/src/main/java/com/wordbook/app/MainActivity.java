package com.wordbook.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Offline HTTPS asset origin keeps module scripts, PDF workers and localStorage on one stable origin. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://wordbook.local/";
    private static final int PICK_FILE = 1, SAVE_FILE = 2;
    private WebView web;
    private TextToSpeech tts;
    private boolean voiceReady;
    private ValueCallback<Uri[]> fileCallback;
    private String saveId, saveText;
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        web.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // System document picker grants selected content URI only.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "WordbookAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!isLocal(request.getUrl())) return errorResponse(403, "Forbidden");
                String resource = request.getUrl().getPath();
                if (resource == null || resource.equals("/")) resource = "/index.html";
                if (resource.contains("..") || resource.contains("\\")) return errorResponse(403, "Forbidden");
                try {
                    String mime = mime(resource);
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open("www" + resource));
                } catch (Exception error) { return errorResponse(404, "Not Found"); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf", "application/json", "text/plain",
                    "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
                try { startActivityForResult(intent, PICK_FILE); }
                catch (Exception error) { fileCallback = null; return false; }
                return true;
            }
        });
        tts = new TextToSpeech(this, status -> runOnUiThread(() -> initVoice(status)));
        web.loadUrl(ORIGIN + "index.html");
    }

    private boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && "wordbook.local".equals(uri.getHost()) && uri.getPort() == -1;
    }
    private WebResourceResponse errorResponse(int code, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", code, reason, null,
            new ByteArrayInputStream(reason.getBytes(StandardCharsets.UTF_8)));
    }
    private String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }
    private void initVoice(int status) {
        if (tts == null || status != TextToSpeech.SUCCESS) return;
        Voice selected = null;
        if (tts.getVoices() != null) for (Voice voice : tts.getVoices()) {
            if (!voice.isNetworkConnectionRequired() && "en".equals(voice.getLocale().getLanguage())) {
                if (selected == null || Locale.US.equals(voice.getLocale())) selected = voice;
                if (Locale.US.equals(voice.getLocale())) break;
            }
        }
        voiceReady = selected != null && tts.setVoice(selected) == TextToSpeech.SUCCESS;
        tts.setSpeechRate(0.85f);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { }
            @Override public void onError(String id) { notifyUser("朗读失败，请检查系统英文语音包"); }
        });
    }
    private void notifyUser(String message) { runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show()); }

    public final class Bridge {
        @JavascriptInterface public void speak(String word) {
            if (word == null || word.length() > TextToSpeech.getMaxSpeechInputLength()) return;
            runOnUiThread(() -> {
                if (!voiceReady || tts == null) { notifyUser("请先在系统文字转语音设置中安装离线英文语音包"); return; }
                if (tts.speak(word, TextToSpeech.QUEUE_FLUSH, null, "wordbook") == TextToSpeech.ERROR)
                    notifyUser("朗读失败，请检查系统语音设置");
            });
        }
        @JavascriptInterface public void saveFile(String name, String text, String id) {
            if (id == null || id.length() > 100) return;
            runOnUiThread(() -> {
                if (saveId != null) { finishSave(id, false, "已有导出进行中"); return; }
                if (text == null || text.length() > 100 * 1024 * 1024) { finishSave(id, false, "导出数据过大"); return; }
                saveId = id; saveText = text;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, name == null ? "wordbook-backup.json" : name.replaceAll("[\\\\/:*?\"<>|]", "_"));
                try { startActivityForResult(intent, SAVE_FILE); }
                catch (Exception error) { saveId = null; saveText = null; finishSave(id, false, "无法打开系统保存窗口"); }
            });
        }
    }
    private void finishSave(String id, boolean saved, String error) {
        JSONObject result = new JSONObject();
        try { result.put("id", id); result.put("saved", saved); if (error != null) result.put("error", error); }
        catch (Exception ignored) { return; }
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('wordbook-native-result',{detail:" + result + "}))", null);
        });
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data)); fileCallback = null;
        }
        if (request == SAVE_FILE && saveId != null) {
            String id = saveId, text = saveText; saveId = null; saveText = null;
            Uri uri = data == null ? null : data.getData();
            if (result != RESULT_OK || uri == null) { finishSave(id, false, null); return; }
            io.execute(() -> {
                try (OutputStream stream = getContentResolver().openOutputStream(uri, "wt")) {
                    if (stream == null) throw new java.io.IOException("No output stream");
                    stream.write(text.getBytes(StandardCharsets.UTF_8));
                } catch (Exception error) { finishSave(id, false, "备份写入失败，请重新导出"); return; }
                finishSave(id, true, null);
            });
        }
    }
    @Override public void onBackPressed() {
        super.onBackPressed();
    }
    @Override protected void onPause() { if (tts != null) tts.stop(); super.onPause(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
        if (web != null) { web.removeJavascriptInterface("WordbookAndroid"); web.destroy(); web = null; }
        io.shutdown();
        super.onDestroy();
    }
}
