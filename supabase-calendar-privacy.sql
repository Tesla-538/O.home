-- O.HOME 캘린더 개인정보 보호 패치
-- 전체 일정 원본은 관리자만 읽고, 방문자는 서버가 정제한 공개 일정만 받습니다.
drop policy if exists "settings_select" on public.site_settings;
create policy "settings_select" on public.site_settings for select
  using (key <> 'ohome.sched.v1' or public.is_admin());
