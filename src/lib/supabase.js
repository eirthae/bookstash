// BookStash is backend-free (everything is on-device). This shim keeps the
// FicStash-ported screens' `hasSupabase` checks meaningful: always false, so the
// "real data" path (on-device) is used and there's no demo/sample fallback.
export const hasSupabase = false;
