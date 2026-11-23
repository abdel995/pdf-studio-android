package com.pdfstudio.pro;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class WebAppInterface {
    private final MainActivity activity;
    private static final String CHANNEL_ID = "pdf_studio_downloads";

    public WebAppInterface(MainActivity activity) {
        this.activity = activity;
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Téléchargements PDF Studio";
            String description = "Notifications des documents PDF générés";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = activity.getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @JavascriptInterface
    public void showToast(String message) {
        activity.runOnUiThread(() -> Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
    }

    @JavascriptInterface
    public void saveBase64File(String base64Data, String fileName, String mimeType) {
        activity.runOnUiThread(() -> {
            try {
                if (base64Data.contains(",")) {
                    base64Data = base64Data.split(",")[1];
                }
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

                Uri fileUri = null;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/PDFStudioPro");

                    fileUri = activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (fileUri != null) {
                        try (OutputStream out = activity.getContentResolver().openOutputStream(fileUri)) {
                            if (out != null) {
                                out.write(fileBytes);
                                out.flush();
                            }
                        }
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File appDir = new File(downloadsDir, "PDFStudioPro");
                    if (!appDir.exists()) appDir.mkdirs();
                    File destFile = new File(appDir, fileName);

                    try (FileOutputStream fos = new FileOutputStream(destFile)) {
                        fos.write(fileBytes);
                        fos.flush();
                    }
                    fileUri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", destFile);
                }

                Toast.makeText(activity, "✓ Fichier enregistré : " + fileName, Toast.LENGTH_LONG).show();

                // Show notification and offer to open file
                if (fileUri != null) {
                    showDownloadNotification(fileName, fileUri, mimeType);
                }

            } catch (Exception e) {
                e.printStackTrace();
                Toast.makeText(activity, "Erreur enregistrement : " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void showDownloadNotification(String fileName, Uri fileUri, String mimeType) {
        try {
            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(fileUri, mimeType);
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                    activity,
                    0,
                    viewIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(activity, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle("Document prêt : " + fileName)
                    .setContentText("Appuyez pour ouvrir le fichier")
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true);

            NotificationManager notificationManager = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.notify((int) System.currentTimeMillis(), builder.build());
            }
        } catch (Exception ignored) {
        }
    }
}
