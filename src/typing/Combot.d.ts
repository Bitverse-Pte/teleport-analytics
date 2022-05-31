export interface CombotAnalyticResult {
    "total_messages": number;
    "hourly_messages": number;
    "daily_messages": number;
    "daily_users": number;
    "active_users": number;
    "new_users": number;
    time_series: Array<[number, {
        a: number;
        n: number;
        s: number;
        m: number;
    }]>;
}