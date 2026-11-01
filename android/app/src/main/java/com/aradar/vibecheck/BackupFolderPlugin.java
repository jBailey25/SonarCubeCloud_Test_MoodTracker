package com.aradar.vibecheck;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Writes automatic backups into a folder the user picks once, using the Storage
 * Access Framework. SAF needs no manifest permission, which keeps the F-Droid
 * build clean. takePersistableUriPermission keeps the folder usable after reboots.
 * Ported from Mooneva Cycle's BackupFolderPlugin.
 */
@CapacitorPlugin(name = "BackupFolder")
public class BackupFolderPlugin extends Plugin {

    private static final String MIME_JSON = "application/json";
    private static final int RW = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(RW | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "onFolderPicked");
    }

    @ActivityCallback
    private void onFolderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri treeUri = result.getData().getData();
        try {
            // Without this the grant dies at the next reboot.
            getContext().getContentResolver().takePersistableUriPermission(treeUri, RW);
        } catch (SecurityException e) {
            call.reject("Could not keep permission for that folder", e);
            return;
        }

        DocumentFile folder = DocumentFile.fromTreeUri(getContext(), treeUri);
        JSObject picked = new JSObject();
        picked.put("cancelled", false);
        picked.put("target", treeUri.toString());
        picked.put("label", folder != null && folder.getName() != null ? folder.getName() : "");
        call.resolve(picked);
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        String target = call.getString("target");
        String name = call.getString("name");
        String data = call.getString("data");
        if (target == null || name == null || data == null) {
            call.reject("target, name and data are required");
            return;
        }

        DocumentFile folder = resolveFolder(target);
        if (folder == null || !folder.canWrite()) {
            call.reject("The backup folder is no longer available. Choose it again in Settings.");
            return;
        }

        try {
            // Reuse an existing file rather than delete-then-create, so a failed
            // create can never destroy the previous backup. "wt" truncates it.
            DocumentFile file = folder.findFile(name);
            if (file == null) file = folder.createFile(MIME_JSON, name);
            if (file == null) {
                call.reject("Could not create the backup file");
                return;
            }
            try (OutputStream out = getContext().getContentResolver().openOutputStream(file.getUri(), "wt")) {
                if (out == null) {
                    call.reject("Could not open the backup file for writing");
                    return;
                }
                out.write(data.getBytes(StandardCharsets.UTF_8));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to write the backup", e);
        }
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        DocumentFile folder = resolveFolder(call.getString("target"));
        if (folder == null) {
            call.reject("The backup folder is no longer available");
            return;
        }
        JSArray names = new JSArray();
        for (DocumentFile file : folder.listFiles()) {
            if (file.isFile() && file.getName() != null) names.put(file.getName());
        }
        JSObject result = new JSObject();
        result.put("names", names);
        call.resolve(result);
    }

    @PluginMethod
    public void deleteFile(PluginCall call) {
        DocumentFile folder = resolveFolder(call.getString("target"));
        String name = call.getString("name");
        if (folder == null || name == null) {
            call.reject("The backup folder is no longer available");
            return;
        }
        DocumentFile file = folder.findFile(name);
        if (file != null) file.delete();
        call.resolve();
    }

    /** Releases the persisted grant when the user turns auto backup off. */
    @PluginMethod
    public void releaseFolder(PluginCall call) {
        String target = call.getString("target");
        if (target != null) {
            try {
                getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(target), RW);
            } catch (Exception ignored) {
                // Already gone or never held: nothing to release.
            }
        }
        call.resolve();
    }

    private DocumentFile resolveFolder(String target) {
        if (target == null) return null;
        try {
            DocumentFile folder = DocumentFile.fromTreeUri(getContext(), Uri.parse(target));
            return folder != null && folder.exists() ? folder : null;
        } catch (Exception e) {
            return null;
        }
    }
}
