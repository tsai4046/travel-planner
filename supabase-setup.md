# 旅行手帖後端設定指南

## 一、建立 Supabase 專案（5 分鐘）

1. 前往 https://supabase.com → 用 GitHub 帳號免費註冊
2. 點「New Project」，填入：
   - Name: `travel-planner`
   - Database Password: 自訂一個強密碼（記住它）
   - Region: `Northeast Asia (Tokyo)` — 離台灣最近
3. 等待約 1 分鐘建立完成
4. 進入專案後，記下兩個值（Settings → API）：
   - **Project URL**：`https://hjyrfjqhivbjivcmfwai.supabase.co`
   - **anon public key**：`sb_publishable_-t1RzF99TAtTeW1lXjZurg_j2VjoU90`

---

## 二、建立資料庫結構

進入 Supabase → **SQL Editor** → 貼入以下 SQL 執行：

```sql
-- ══════════════════════════════════════
-- 旅行手帖 資料庫結構
-- ══════════════════════════════════════

-- 1. 行程主表
CREATE TABLE trips (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trip_key      TEXT NOT NULL,          -- 使用者自訂 ID，如 "japan-2026"
  data          JSONB NOT NULL,         -- 完整行程 JSON
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, trip_key)
);

-- 2. 分享連結表
CREATE TABLE shares (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id       UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  share_token   TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  permission    TEXT CHECK (permission IN ('view', 'edit')) DEFAULT 'view',
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ            -- NULL 表示永不過期
);

-- 3. 協作者表（被邀請可編輯的人）
CREATE TABLE collaborators (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id       UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role          TEXT CHECK (role IN ('editor', 'viewer')) DEFAULT 'editor',
  invited_by    UUID REFERENCES auth.users(id),
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- 4. 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════
-- Row Level Security（RLS）權限控制
-- ══════════════════════════════════════

ALTER TABLE trips        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares       ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;

-- trips：擁有者可完整操作；協作者可讀寫
CREATE POLICY "owner_all" ON trips
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "collaborator_select" ON trips
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM collaborators
            WHERE trip_id = trips.id AND user_id = auth.uid())
  );

CREATE POLICY "collaborator_update" ON trips
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM collaborators
            WHERE trip_id = trips.id AND user_id = auth.uid() AND role = 'editor')
  );

-- shares：任何人可用 token 讀取（含未登入的訪客）
CREATE POLICY "public_view_by_token" ON shares
  FOR SELECT USING (true);

CREATE POLICY "owner_manage_shares" ON shares
  FOR ALL USING (
    EXISTS (SELECT 1 FROM trips
            WHERE id = shares.trip_id AND owner_id = auth.uid())
  );

-- collaborators：擁有者管理；本人可查看自己的記錄
CREATE POLICY "owner_manage_collaborators" ON collaborators
  FOR ALL USING (
    EXISTS (SELECT 1 FROM trips
            WHERE id = collaborators.trip_id AND owner_id = auth.uid())
  );

CREATE POLICY "self_view" ON collaborators
  FOR SELECT USING (auth.uid() = user_id);

-- ══════════════════════════════════════
-- 匿名分享用 Function（繞過 RLS 查行程）
-- ══════════════════════════════════════

CREATE OR REPLACE FUNCTION get_trip_by_share_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_share shares%ROWTYPE;
  v_trip  trips%ROWTYPE;
BEGIN
  SELECT * INTO v_share FROM shares
  WHERE share_token = p_token
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_trip FROM trips WHERE id = v_share.trip_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'trip',       v_trip.data,
    'permission', v_share.permission,
    'trip_id',    v_trip.id
  );
END;
$$;
-- 依 Email 查詢已註冊用戶的 UUID（供邀請協作者用）
CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users
  WHERE LOWER(email) = LOWER(p_email);
  RETURN v_user_id;  -- 未找到時回傳 NULL
END;
$$;
```

---

## 三、設定 Google 登入

1. Supabase → **Authentication** → **Providers** → 找到 Google → 開啟
2. 複製 **Callback URL**（形如 `https://xxxxx.supabase.co/auth/v1/callback`）
3. 前往 https://console.cloud.google.com → 建立新專案（或用既有的）
4. APIs & Services → **Credentials** → Create Credentials → OAuth 2.0 Client
   - Application type: Web application
   - Authorized redirect URIs: 貼上步驟 2 的 Callback URL
5. 複製 **Client ID** 和 **Client Secret** → 貼回 Supabase Google Provider 設定

---

## 四、填入 travel-planner.html

打開 travel-planner.html，找到最頂部的設定區塊，填入你的值：

```javascript
const SUPABASE_URL = 'https://你的專案ID.supabase.co';
const SUPABASE_ANON_KEY = '你的 anon public key';
```

---

## 五、部署上線（可選）

如果想要分享連結能讓別人開啟，需要把網頁放到公開網址上。最簡單的方式：

**Netlify Drop**（零設定，30 秒上線）
1. 前往 https://app.netlify.com/drop
2. 把 `travel-planner.html` 直接拖曳到瀏覽器
3. 得到一個 `xxx.netlify.app` 的網址
4. 把這個網址加入 Google OAuth 的 Authorized JavaScript Origins

**自訂網域**（可選）：在 Netlify 設定中加入你自己的 domain。

---

## 資料結構說明

```
trips 表
├── id            UUID（主鍵，Supabase 自動生成）
├── owner_id      登入者的 user ID
├── trip_key      行程的字串 ID，如 "japan-2026"（顯示用）
├── data          完整行程 JSON（就是你在旅行手帖編輯器看到的那份）
└── updated_at    最後更新時間（自動維護）

shares 表
├── trip_id       對應 trips.id
├── share_token   隨機 24 字元 token（URL 中的分享碼）
└── permission    "view"（唯讀）或 "edit"（可編輯）

collaborators 表
├── trip_id       對應 trips.id
├── user_id       被邀請者的 user ID
└── role          "editor" 或 "viewer"
```

---

## 常見問題

**Q：免費版有什麼限制？**
Supabase 免費版：500MB 資料庫、50,000 月活躍用戶、2GB 頻寬，個人旅遊用途完全夠用。

**Q：如果我不想部署，可以在本機用嗎？**
可以，直接用瀏覽器開啟 travel-planner.html 即可登入和使用所有功能。分享連結功能需要對方能連上同一個 Supabase 專案（他們只要有網路就能用），不需要你的電腦開著。

**Q：協作者需要帳號嗎？**
- 唯讀分享：不需要，直接開連結就能看
- 編輯協作：需要用 Google 帳號登入
