-- FCM token for native push notifications in the QuotingHub Staff APK
ALTER TABLE elec_staff ADD COLUMN IF NOT EXISTS fcm_token TEXT;
