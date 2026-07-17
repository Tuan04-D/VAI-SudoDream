export default function ProfilePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-5 pt-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <h1 className="font-display text-xl font-bold">Hồ sơ chưa mở</h1>
      <p className="max-w-xs text-sm text-ink-muted">
        Đăng nhập, đăng ký và lịch sử tài khoản sẽ có ở bản sau. Hiện tại mọi người có thể dùng đầy đủ
        phần dự báo, thông báo và hỏi đáp mà không cần tài khoản.
      </p>
    </main>
  );
}
