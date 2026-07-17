import { fetchCommunes, fetchForecast } from "@/lib/api";
import RiskHeroCard from "@/components/home/RiskHeroCard";
import HeroVideo from "@/components/home/HeroVideo";

async function loadHome() {
  try {
    const { default_commune_id, communes } = await fetchCommunes();
    const commune = communes.find((c) => c.id === default_commune_id) ?? communes[0];
    const forecast = await fetchForecast(commune.id, 1);
    return { commune, today: forecast.forecast[0] };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const home = await loadHome();

  return (
    <section className="relative min-h-[calc(100dvh-5rem)] overflow-hidden lg:min-h-[calc(100dvh-4.5rem)]">
      <HeroVideo />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d1730]/95 via-[#16244a]/60 to-[#16244a]/25" />
      <div className="bg-contour-light absolute inset-0 opacity-30" aria-hidden />

      <div className="relative flex min-h-[calc(100dvh-5rem)] flex-col justify-between px-5 py-6 lg:min-h-[calc(100dvh-4.5rem)] lg:justify-center lg:px-8 lg:py-14">
        <header className="flex items-center gap-2.5 lg:hidden">
          <MountainMark />
          <p className="font-display text-xl font-extrabold tracking-tight text-white">Trạm Bản</p>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center lg:max-w-none lg:flex-row lg:items-center lg:justify-center lg:gap-16 lg:text-left">
          <div className="lg:max-w-md">
            <p className="font-display text-2xl font-extrabold leading-tight text-white lg:text-4xl">
              Cảnh báo thời tiết theo từng xã, có nói được tiếng mẹ đẻ
            </p>
            <p className="mt-3 text-sm text-white/75 lg:text-base">
              Dự báo hiệu chỉnh theo địa hình, độ tin cậy minh bạch, và một trợ lý trả lời bằng giọng nói
              tiếng Việt hoặc tiếng H&apos;Mông.
            </p>
          </div>

          <div className="w-full max-w-sm">
            {home ? (
              <RiskHeroCard commune={home.commune} today={home.today} />
            ) : (
              <div className="rounded-lg border border-white/15 bg-white/10 p-5 text-sm text-white/80 backdrop-blur">
                Chưa kết nối được máy chủ dữ liệu. Hãy chắc chắn server chính đang chạy ở{" "}
                <code className="font-data">localhost:8000</code>.
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-white/50 lg:hidden">Điện Biên · Việt Nam</p>
      </div>
    </section>
  );
}

function MountainMark() {
  return (
    <svg viewBox="0 0 64 40" className="h-8 w-12 text-white" fill="currentColor">
      <path d="M0 40 14 18l7 8 9-16 12 18 6-8 16 20Z" />
    </svg>
  );
}
