const OPEN_WEATHER_API_KEY = "01e187216ba4a2dcc1712a4d95b70b56";// <-- add your key

export async function willLikelyRainOnDate(lat: number, lng: number, ymd: string) {
    const res = await fetch(
        `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lng}&exclude=minutely,hourly,alerts&units=metric&appid=${OPEN_WEATHER_API_KEY}`
    );
    if (!res.ok) return false;
    const data = await res.json();

    const target = new Date(ymd);
    const isSameDay = (ts: number) => {
        const d = new Date(ts * 1000);
        return d.getFullYear() === target.getFullYear() &&
            d.getMonth() === target.getMonth() &&
            d.getDate() === target.getDate();
    };

    const day = (data.daily || []).find((d: any) => isSameDay(d.dt));
    if (!day) return false;

    const pop = day.pop ?? 0;
    const rainyMain = (day.weather || []).some((w: any) => /rain|drizzle|thunderstorm/i.test(w.main));
    return pop >= 0.4 || rainyMain;
}
