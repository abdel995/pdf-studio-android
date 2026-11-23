package com.pdfstudio.pro;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.pdfstudio.pro.R;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> uploadMessage;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                new ActivityResultCallback<ActivityResult>() {
                    @Override
                    public void onActivityResult(ActivityResult result) {
                        if (uploadMessage == null) return;
                        Uri[] results = null;
                        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                            Intent data = result.getData();
                            if (data.getClipData() != null) {
                                ClipData clipData = data.getClipData();
                                int count = clipData.getItemCount();
                                results = new Uri[count];
                                for (int i = 0; i < count; i++) {
                                    results[i] = clipData.getItemAt(i).getUri();
                                }
                            } else if (data.getData() != null) {
                                results = new Uri[]{data.getData()};
                            }
                        }
                        uploadMessage.onReceiveValue(results);
                        uploadMessage = null;
                    }
                }
        );

        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        checkAndRequestPermissions();
        setupWebView();

        // Load local offline application from assets
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Bridge to native Android functionality (saving files, notifications, toasts)
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file://") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1") || url.startsWith("http://192.168.")) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);

                // Convert file extensions (e.g. ".pdf") into valid Android MIME types (e.g. "application/pdf")
                String[] rawAcceptTypes = fileChooserParams.getAcceptTypes();
                List<String> validMimes = new ArrayList<>();
                if (rawAcceptTypes != null) {
                    for (String raw : rawAcceptTypes) {
                        if (raw != null && !raw.trim().isEmpty()) {
                            String m = resolveMimeType(raw);
                            if (!validMimes.contains(m) && !m.equals("*/*")) {
                                validMimes.add(m);
                            }
                        }
                    }
                }

                if (validMimes.size() == 1) {
                    intent.setType(validMimes.get(0));
                } else if (validMimes.size() > 1) {
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, validMimes.toArray(new String[0]));
                } else {
                    intent.setType("*/*");
                }

                if (fileChooserParams.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }

                try {
                    fileChooserLauncher.launch(Intent.createChooser(intent, "Choisir un document ou une image"));
                } catch (Exception e) {
                    if (uploadMessage != null) {
                        uploadMessage.onReceiveValue(null);
                        uploadMessage = null;
                    }
                    Toast.makeText(MainActivity.this, "Impossible d'ouvrir le s\u00e9lecteur de fichiers", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
    }

    private String resolveMimeType(String raw) {
        if (raw == null) return "*/*";
        raw = raw.trim().toLowerCase();
        if (raw.isEmpty() || raw.equals("*/*")) return "*/*";
        if (raw.equals(".pdf") || raw.contains("pdf")) return "application/pdf";
        if (raw.equals(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (raw.equals(".doc")) return "application/msword";
        if (raw.startsWith("image/") || raw.equals(".png") || raw.equals(".jpg") || raw.equals(".jpeg") || raw.equals(".webp") || raw.equals(".bmp")) {
            return raw.startsWith("image/") ? raw : "image/*";
        }
        if (raw.contains("/")) return raw;
        return "*/*";
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{
                        Manifest.permission.READ_EXTERNAL_STORAGE,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                }, 101);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
