-- Google のプロフィール写真の URL を消す。users.image をプロフィールと投稿に公開するので、
-- このサービスが用意した画像（/ で始まるパス）だけを残す。
UPDATE `users` SET `image` = NULL WHERE `image` IS NOT NULL AND `image` NOT LIKE '/%';
