package com.wordbook.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
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
import android.widget.FrameLayout;
import android.view.View;
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
    private String speechId;
    private ValueCallback<Uri[]> fileCallback;
    private String saveId, saveText;
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.WHITE);
        container.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(container);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        // WebView itself ignores content padding; apply system insets to its native parent.
        container.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        container.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // System document picker grants selected content URI only.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE); // APK updates replace assets; persistent word data lives in DOM storage.
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
            @Override public void onDone(String id) { finishSpeech(id, null); }
            @Override public void onError(String id) { finishSpeech(id, "朗读失败，请检查系统英文语音包"); }
        });
    }

    public final class Bridge {
        @JavascriptInterface public void speak(String word, double rate, String id) {
            if (id == null || id.length() > 100) return;
            runOnUiThread(() -> {
                if (word == null || word.length() > TextToSpeech.getMaxSpeechInputLength()) { finishSpeech(id, "单词过长"); return; }
                if (!voiceReady || tts == null) { finishSpeech(id, "请先在系统文字转语音设置中安装离线英文语音包"); return; }
                speechId = id;
                tts.setSpeechRate((float) Math.max(0.5, Math.min(1.5, rate)));
                if (tts.speak(word, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.ERROR)
                    finishSpeech(id, "朗读失败，请检查系统语音设置");
            });
        }
        @JavascriptInterface public void stopSpeech() {
            runOnUiThread(() -> { if (tts != null) tts.stop(); if (speechId != null) finishSpeech(speechId, "朗读已取消"); });
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
    private void finishSpeech(String id, String error) {
        JSONObject result = new JSONObject();
        try { result.put("id", id); if (error != null) result.put("error", error); }
        catch (Exception ignored) { return; }
        runOnUiThread(() -> {
            if (id.equals(speechId)) speechId = null;
            if (web != null) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('wordbook-speech-result',{detail:" + result + "}))", null);
        });
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
    @Override protected void onPause() {
        if (tts != null) tts.stop();
        if (speechId != null) finishSpeech(speechId, "应用已进入后台，朗读已停止");
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new Event('wordbook-background'))", null);
        super.onPause();
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
        if (web != null) { web.removeJavascriptInterface("WordbookAndroid"); web.destroy(); web = null; }
        io.shutdown();
        super.onDestroy();
    }
}
