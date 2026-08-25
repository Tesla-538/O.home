'use client';
// 메인 페이지 (4.0 위젯 시스템) — 고정 요소(배너·회원정보창) + 자유 배치 위젯 + 편집모드
import React, { useEffect, useState } from 'react';
import { useMainStore, WidgetConf, WidgetType, WIDGET_META, MULTI_TYPES, widgetLabel } from '@/lib/mainStore';
import { WidgetFrame } from '@/components/main/WidgetFrame';
import { renderWidget } from '@/components/main/widgets';
import { MemberBox } from '@/components/main/MemberBox';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { KRadio, KStep } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { useTheme } from '@/lib/ThemeProvider';
import { putBlob, useBlobUrl } from '@/lib/blobStore';

type HomeView = 'focus' | 'dashboard';

const DOCK_ICON: Partial<Record<WidgetType, React.ReactNode>> = {
  banner: <><path d="M5 7.5h14v9H5z"/><path d="m7 14 3.2-3 2.5 2 1.8-1.6L17 14"/></>,
  member: <><circle cx="12" cy="9" r="3"/><path d="M6.5 18c.8-3 2.6-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/></>,
  memo: <><path d="M6 5h12v14H6z"/><path d="M9 9h6M9 12h6M9 15h4"/></>,
  diary: <><path d="M7 4.5h10v15H7zM10 4.5v15"/><path d="M12.5 9h2.5M12.5 12h2.5"/></>,
  latest: <><rect x="5" y="6" width="14" height="12" rx="2"/><circle cx="10" cy="10" r="1.5"/><path d="m7 16 3.5-3 2.5 2 2-2 2 3"/></>,
  dday: <><rect x="5" y="6" width="14" height="13" rx="2"/><path d="M8 4v4M16 4v4M5 10h14"/><path d="M9 14h6"/></>,
  todo: <><rect x="5" y="5" width="14" height="14" rx="2"/><path d="m8 12 2 2 5-5"/></>,
  upcoming: <><circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/></>,
  freetext: <><path d="M5 7h14M8 7v11M16 7v11M8 12h8"/></>,
  deco: <><path d="M12 4.5 14 10l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z"/></>,
  memoboard: <><path d="M5 5h14v14H5z"/><path d="M8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8z"/></>,
};

function DockGlyph({ type }: { type: WidgetType }) {
  return <svg viewBox="0 0 24 24" aria-hidden>{DOCK_ICON[type] ?? DOCK_ICON.deco}</svg>;
}

const ADDABLE: WidgetType[] = ['memo', 'dday', 'todo', 'upcoming', 'freetext', 'deco', 'diary', 'latest'];
/** 내용 설정 모달이 있는 위젯 — 우클릭 「설정」 노출 대상 (v1.9) */
const EDITABLE: WidgetType[] = ['banner', 'memo', 'dday', 'todo', 'freetext', 'deco'];

export default function MainPage() {
  const { state, editOn, gridOn, updateWidget, addWidget, removeWidget } = useMainStore();
  const theme = useTheme();
  const toast = useToast();
  const [ctx, setCtx] = useState<{ id: string; x: number; y: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<WidgetType>('freetext');
  const [addCol, setAddCol] = useState<'1' | '2' | '3'>('3');
  const [addedWidgetId, setAddedWidgetId] = useState<string | null>(null);
  const [delAsk, setDelAsk] = useState<WidgetConf | null>(null);   // 우클릭 삭제 경고 (v1.9)
  const [bgOpen, setBgOpen] = useState(false);
  const [homeView, setHomeView] = useState<HomeView>('focus');
  const [dockOpen, setDockOpen] = useState<string | null>(null);
  const [dockClosing, setDockClosing] = useState(false);
  const [viewMotion, setViewMotion] = useState<'idle' | 'leaving' | 'entering'>('idle');
  const [isMobile, setIsMobile] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const bgFileRef = React.useRef<HTMLInputElement>(null);
  const dockCloseTimer = React.useRef<number | null>(null);
  const viewTimers = React.useRef<number[]>([]);
  const bgPreview = useBlobUrl(theme.state.vars.bgImageId);

  const closeDock = () => {
    if (!dockOpen || dockClosing) return;
    setDockClosing(true);
    if (dockCloseTimer.current) window.clearTimeout(dockCloseTimer.current);
    dockCloseTimer.current = window.setTimeout(() => {
      setDockOpen(null);
      setDockClosing(false);
      dockCloseTimer.current = null;
    }, 230);
  };

  const toggleDock = (id: string) => {
    if (dockOpen === id) { closeDock(); return; }
    if (dockCloseTimer.current) window.clearTimeout(dockCloseTimer.current);
    dockCloseTimer.current = null;
    setDockClosing(false);
    setDockOpen(id);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ohome.homeView.v1');
      if (stored === 'dashboard') setHomeView('dashboard');
    } catch { /* 기본 감상 모드 */ }
  }, []);

  useEffect(() => {
    if (editOn) { setDockOpen(null); setDockClosing(false); }
  }, [editOn]);

  useEffect(() => {
    const media = window.matchMedia('(max-width:620px)');
    const sync = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      // 1320px 고정 캔버스는 보기 모드에서만 화면 폭에 맞춰 통째로 축소한다.
      // 위젯별 좌표를 다시 계산하지 않아 원래 배열과 간격이 그대로 유지된다.
      const appWidth = document.getElementById('appMain')?.clientWidth ?? window.innerWidth;
      setCanvasScale(mobile ? 1 : Math.min(1, Math.max(0.1, appWidth / 1320)));
    };
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('resize', sync); };
  }, []);

  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDock(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [dockOpen, dockClosing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (dockCloseTimer.current) window.clearTimeout(dockCloseTimer.current);
    viewTimers.current.forEach(t => window.clearTimeout(t));
  }, []);

  const changeHomeView = (view: HomeView) => {
    if (view === homeView || viewMotion !== 'idle') return;
    closeDock();
    viewTimers.current.forEach(t => window.clearTimeout(t));
    setViewMotion('leaving');
    viewTimers.current = [
      window.setTimeout(() => {
        setHomeView(view);
        setDockOpen(null);
        setDockClosing(false);
        setViewMotion('entering');
      }, 230),
      window.setTimeout(() => setViewMotion('idle'), 940),
    ];
    try { localStorage.setItem('ohome.homeView.v1', view); } catch { /* 무시 */ }
  };

  // 위젯 추가 — 상단바의 [＋ 위젯] 버튼(그리드 토글 왼쪽)이 이벤트로 연다 (v1.9 사용자 확정)
  useEffect(() => {
    const open = () => setAddOpen(true);
    window.addEventListener('ohome-add-widget', open);
    return () => window.removeEventListener('ohome-add-widget', open);
  }, []);

  // 편집모드 상단바 [배경화면] — 환경설정까지 이동하지 않고 현재 화면에서 바로 교체
  useEffect(() => {
    const open = () => setBgOpen(true);
    window.addEventListener('ohome-background-edit', open);
    return () => window.removeEventListener('ohome-background-edit', open);
  }, []);

  const closeBackground = () => {
    theme.discard();
    setBgOpen(false);
  };

  // 모달을 열 때 선택돼 있던 종류가 이미 추가된 것이면 항상 가능한 자유 텍스트로 (v1.9)
  useEffect(() => {
    if (!addOpen) return;
    if (!MULTI_TYPES.includes(addType) && state.widgets.some(w => w.type === addType)) setAddType('freetext');
  }, [addOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새 위젯은 선택한 열의 기존 위젯 아래에 생겨 화면 밖일 수 있다.
  // 고정 시간 뒤 DOM을 찾는 대신 실제 렌더 완료 후 이동하고 잠깐 강조한다.
  useEffect(() => {
    if (!addedWidgetId || !state.widgets.some(w => w.id === addedWidgetId)) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        document.querySelector(`[data-wid="${addedWidgetId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      });
    });
    const done = window.setTimeout(() => setAddedWidgetId(null), 1600);
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(done); };
  }, [addedWidgetId, state.widgets]);

  const enabled = state.widgets.filter(w => w.enabled);
  const dockable = enabled.filter(w => w.type !== 'menu');
  const leftDock = dockable.filter(w => w.col !== 3);
  const rightDock = dockable.filter(w => w.col === 3);
  const openDockWidget = dockable.find(w => w.id === dockOpen) ?? null;
  const focusActive = !editOn && homeView === 'focus' && !isMobile;
  const showDashboard = editOn || homeView === 'dashboard' || isMobile;
  const byCol = (c: 1 | 2 | 3) => enabled.filter(w => w.col === c);
  const mOrder = (id: string) => {
    const i = state.mobileOrder.indexOf(id);
    return i === -1 ? 99 : i;
  };

  // 우클릭 겹침 순서 조정 (v1.8) — z가 있는 위젯들 사이에서 이동
  const zOp = (mode: 'top' | 'bottom' | 'up' | 'down') => {
    if (!ctx) return;
    const all = enabled.filter(w => w.z != null);
    const me = enabled.find(w => w.id === ctx.id);
    if (!me) return;
    const zs = all.map(w => w.z!) ;
    const cur = me.z ?? 0;
    if (mode === 'top') updateWidget(me.id, { z: (zs.length ? Math.max(...zs) : 0) + 1 });
    if (mode === 'bottom') updateWidget(me.id, { z: Math.max(0, (zs.length ? Math.min(...zs) : 1) - 1) });
    if (mode === 'up') {
      const hi = zs.filter(z => z > cur);
      if (hi.length) {
        const nz = Math.min(...hi);
        const other = all.find(w => w.z === nz)!;
        updateWidget(other.id, { z: cur });
        updateWidget(me.id, { z: nz });
      }
    }
    if (mode === 'down') {
      const lo = zs.filter(z => z < cur);
      if (lo.length) {
        const nz = Math.max(...lo);
        const other = all.find(w => w.z === nz)!;
        updateWidget(other.id, { z: cur });
        updateWidget(me.id, { z: nz });
      }
    }
    setCtx(null);
  };

  const frame = (w: WidgetConf, className?: string) => (
    <WidgetFrame key={w.id} conf={w} mobileOrder={mOrder(w.id)}
      className={[className, addedWidgetId === w.id ? 'wgt-just-added' : ''].filter(Boolean).join(' ')}
      onCtx={(id, x, y) => {
        // 우클릭 시 z 기본값 부여 (겹침 조정 대상화)
        if (state.widgets.find(v => v.id === id)?.z == null) {
          const zs = enabled.map(v => v.z ?? 0);
          updateWidget(id, { z: Math.max(...zs, 0) + 1 });
        }
        setCtx({ id, x, y });
      }}>
      {renderWidget(w)}
    </WidgetFrame>
  );

  const widgetBody = (w: WidgetConf) => w.type === 'member' ? <MemberBox /> : renderWidget(w);

  const dock = (side: 'left' | 'right', widgets: WidgetConf[]) => (
    <nav className={`focus-dock focus-dock-${side}`} aria-label={`${side === 'left' ? '왼쪽' : '오른쪽'} 위젯 도크`}>
      {widgets.map(w => (
        <button key={w.id} className={dockOpen === w.id ? 'on' : ''}
          aria-label={`${widgetLabel(state.widgets, w)} 위젯 ${dockOpen === w.id ? '닫기' : '열기'}`}
          aria-expanded={dockOpen === w.id}
          onClick={e => { e.stopPropagation(); toggleDock(w.id); }}>
          <DockGlyph type={w.type} />
          <span>{widgetLabel(state.widgets, w)}</span>
        </button>
      ))}
    </nav>
  );

  // PC 절대배치 (v1.9 사용자 확정) — 모든 위젯에 절대 좌표가 있으면 캔버스 모드:
  // 문서 흐름 없음(겹침 허용·서로 밀지 않음). 좌표가 없는 저장분은 아래 effect가
  // 기존 열 흐름 렌더 위치를 1회 스냅샷해 마이그레이션. 모바일은 CSS가 흐름 스택으로 복원.
  const absMode = enabled.length > 0 && enabled.every(w => w.ax != null && w.ay != null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (absMode) return;
    const t = setTimeout(() => {
      const gr = gridRef.current?.getBoundingClientRect();
      if (!gr || gr.width < 100) return;   // 모바일/미측정 상태에서는 스냅샷하지 않음
      enabled.forEach(w => {
        if (w.ax != null) return;
        const el = document.querySelector(`[data-wid="${w.id}"]`);
        if (!el) return;
        const r = el.getBoundingClientRect();
        updateWidget(w.id, {
          ax: Math.round(r.left - gr.left), ay: Math.round(r.top - gr.top),
          w: w.w ?? Math.max(160, Math.round(r.width)), h: w.h ?? Math.max(80, Math.round(r.height)),
          tx: 0, ty: 0,
        }, { persist: true });
      });
    }, 250);   // 폰트·이미지 로드 후 안정된 레이아웃에서 측정
    return () => clearTimeout(t);
  }, [absMode, enabled.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const canvasH = absMode
    ? Math.max(400, ...enabled.map(w => (w.ay ?? 0) + (w.h ?? 200))) + 40
    : undefined;

  return (
    <section className={`page page-main-wrap ${focusActive ? 'focus-home' : 'dashboard-home'} home-motion-${viewMotion}`}
      style={{ '--home-canvas-scale': canvasScale } as React.CSSProperties}
      onClick={() => { setCtx(null); closeDock(); }}>
      {focusActive && (
        <div className="focus-stage" aria-label="일러스트 감상 화면">
          {dock('left', leftDock)}
          {dock('right', rightDock)}
          {openDockWidget && (
            <aside key={openDockWidget.id} className={`dock-popover dock-popover-${openDockWidget.col === 3 ? 'right' : 'left'} dock-panel-${openDockWidget.type}${dockClosing ? ' dock-closing' : ''}`}
              onClick={e => e.stopPropagation()} aria-label={`${widgetLabel(state.widgets, openDockWidget)} 위젯`}>
              <button className="dock-popover-close" aria-label="위젯 닫기" onClick={closeDock}>×</button>
              {widgetBody(openDockWidget)}
            </aside>
          )}
          <div className="focus-hint">아이콘을 눌러 위젯 열기</div>
        </div>
      )}

      {!editOn && !isMobile && (
        <button className="home-view-switch" disabled={viewMotion !== 'idle'} onClick={e => {
          e.stopPropagation();
          changeHomeView(homeView === 'focus' ? 'dashboard' : 'focus');
        }}>
          {homeView === 'focus' ? '▦ 전체 위젯' : '✦ 감상 모드'}
        </button>
      )}

      {showDashboard && <div ref={gridRef} className={`main-grid ${absMode ? 'abs' : ''} ${gridOn ? 'gridlines' : ''}`}
        style={{ marginTop: 12, ...(canvasH ? { height: canvasH } : {}) }}>
        {absMode ? (
          /* 절대배치 캔버스 — 위젯 전부 직속, 좌표는 각자 ax/ay */
          enabled.map(w =>
            w.type === 'member'
              ? <WidgetFrame key={w.id} conf={w} mobileOrder={-1} onCtx={(id, x, y) => setCtx({ id, x, y })}><MemberBox /></WidgetFrame>
              : frame(w, w.type === 'menu' ? 'wgt-hide-pc' : undefined))
        ) : (
          <>
            {/* (마이그레이션 전 1회용) 기존 열 흐름 렌더 — 위치 스냅샷 후 절대배치로 전환 */}
            <div>
              {byCol(1).map(w => frame(w, w.type === 'menu' ? 'wgt-hide-pc' : undefined))}
            </div>
            <div>
              {byCol(2).map(w =>
                w.type === 'banner' ? frame(w) : null
              )}
              <div className="g2" style={{ marginTop: 10 }}>
                {byCol(2).filter(w => w.type !== 'banner').map(w => frame(w))}
              </div>
            </div>
            <div>
              {byCol(3).map(w =>
                w.type === 'member'
                  ? <WidgetFrame key={w.id} conf={w} mobileOrder={-1} onCtx={(id, x, y) => setCtx({ id, x, y })}><MemberBox /></WidgetFrame>
                  : frame(w)
              )}
            </div>
          </>
        )}
      </div>}

      {/* 우클릭 컨텍스트 메뉴 (겹침 순서 v1.8 · 그리드 무시 v1.9 · 설정·삭제 v1.9 사용자 확정) */}
      {ctx && (() => {
        const me = enabled.find(w => w.id === ctx.id);
        if (!me) return null;
        return (
          <div className="ctx-menu on" style={{ left: ctx.x, top: ctx.y }} onClick={e => e.stopPropagation()}>
            {/* 어떤 위젯인지 표시 — 중복 추가 위젯은 번호로 구분 (v1.9) */}
            <div className="ctx-ttl">{widgetLabel(state.widgets, me)}</div>
            <div className="sep" />
            <button onClick={() => zOp('top')}>맨위로</button>
            <button onClick={() => zOp('up')}>위로</button>
            <button onClick={() => zOp('down')}>아래로</button>
            <button onClick={() => zOp('bottom')}>맨아래로</button>
            {/* 텍스트·이미지 같은 장식 요소를 그리드에 안 붙게 자유 배치 (v1.9 사용자 확정) */}
            <button onClick={() => { updateWidget(me.id, { freeMove: !me.freeMove }); setCtx(null); }}>
              {me.freeMove ? '그리드 반영' : '그리드 무시'}
            </button>
            {(EDITABLE.includes(me.type) || !me.fixed) && <div className="sep" />}
            {/* 내용 편집 — 편집모드에서도 우클릭으로 설정 모달을 연다 (v1.9 사용자 확정) */}
            {EDITABLE.includes(me.type) && (
              <button onClick={() => {
                window.dispatchEvent(new CustomEvent('ohome-widget-edit', { detail: { id: me.id } }));
                setCtx(null);
              }}>설정</button>
            )}
            {!me.fixed && (
              <button className="danger" onClick={() => { setDelAsk(me); setCtx(null); }}>위젯 삭제</button>
            )}
          </div>
        );
      })()}

      {/* 위젯 삭제 경고 (v1.9 — 모든 삭제는 경고 모달) */}
      <ConfirmModal open={delAsk !== null}
        title={`「${delAsk ? widgetLabel(state.widgets, delAsk) : ''}」 위젯을 삭제할까요?`}
        body="위젯이 메인에서 삭제됩니다. 삭제는 편집 종료 시 「저장 후 종료」를 선택해야 확정되고, 「변경 취소 후 종료」를 선택하면 되돌아옵니다."
        onClose={() => setDelAsk(null)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => { if (delAsk) removeWidget(delAsk.id); setDelAsk(null); toast('위젯이 삭제되었습니다 — 편집 종료 시 저장하면 확정됩니다'); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelAsk(null) },
        ]} />

      {/* 위젯 추가 모달 (4.0 · 중복 방지 v1.9 — 이미지·자유 텍스트만 여러 개 가능) */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} small
        title="위젯 추가" desc="종류와 배치 열을 선택 — 이미 추가한 위젯은 다시 추가할 수 없음 (이미지·자유 텍스트 제외)"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={() => {
            if (!MULTI_TYPES.includes(addType) && state.widgets.some(w => w.type === addType)) return;
            const id = addWidget(addType, Number(addCol) as 1 | 2 | 3);
            setAddedWidgetId(id);
            setAddOpen(false);
            toast('위젯이 추가되었습니다 — 우클릭 메뉴에서 설정·삭제할 수 있습니다');
          }}>ADD</button>
        </>}>
        <div style={{ display: 'grid', gap: 7, marginBottom: 14 }}>
          {ADDABLE.map(t => {
            const taken = !MULTI_TYPES.includes(t) && state.widgets.some(w => w.type === t);
            return (
              <KRadio key={t} name="wgt-type" value={t} current={addType} disabled={taken}
                onChange={v => setAddType(v as WidgetType)}
                label={<span>
                  <b style={{ fontSize: 12.5 }}>{WIDGET_META[t].title}</b>{' '}
                  <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{WIDGET_META[t].desc}</small>
                  {taken && <span className="pill" style={{ marginLeft: 6 }}>추가됨</span>}
                  {MULTI_TYPES.includes(t) && <span className="pill" style={{ marginLeft: 6 }}>중복 추가 가능</span>}
                </span>} />
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <KRadio name="wgt-col" value="1" current={addCol} onChange={v => setAddCol(v as '1')} label="왼쪽 열" />
          <KRadio name="wgt-col" value="2" current={addCol} onChange={v => setAddCol(v as '2')} label="중앙" />
          <KRadio name="wgt-col" value="3" current={addCol} onChange={v => setAddCol(v as '3')} label="오른쪽 열" />
        </div>
      </Modal>

      {/* 편집모드 빠른 배경화면 메뉴 — 테마 저장소를 사용해 다른 기기에도 동일하게 반영 */}
      <Modal open={bgOpen} onClose={closeBackground} small dirty={theme.dirty}
        title="배경화면" desc="이미지를 고르면 현재 화면에서 바로 미리보기됩니다. SAVE를 눌러야 저장됩니다."
        actions={<>
          <button className="btn btn-ghost" onClick={closeBackground}>CANCEL</button>
          <button className="btn btn-dark" disabled={!theme.dirty}
            style={{ opacity: theme.dirty ? 1 : .45 }}
            onClick={() => { theme.save(); setBgOpen(false); toast('배경화면을 저장했습니다'); }}>SAVE</button>
        </>}>
        <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={async e => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const id = await putBlob(f);
              theme.setVar('bgImageId', id);
              theme.setVar('bgType', 'image');
            } catch {
              toast('배경 이미지 업로드에 실패했습니다');
            }
            e.target.value = '';
          }} />
        <div className="bg-quick-preview">
          {bgPreview
            ? <img src={bgPreview} alt="선택한 배경화면 미리보기" />
            : <span>선택된 배경 이미지가 없습니다</span>}
        </div>
        <div className="bg-quick-actions">
          <button className="btn btn-ghost" onClick={() => bgFileRef.current?.click()}>
            {theme.state.vars.bgImageId ? '이미지 교체' : '이미지 업로드'}
          </button>
          <button className="btn btn-ghost" onClick={() => theme.setVar('bgType', 'gradient')}>그라데이션 사용</button>
          {theme.state.vars.bgImageId && (
            <button className="btn btn-ghost" onClick={() => {
              theme.setVar('bgImageId', undefined);
              theme.setVar('bgType', 'gradient');
            }}>이미지 제거</button>
          )}
        </div>
        <div className="bg-quick-blur">
          <span>배경 블러</span>
          <KStep value={theme.state.vars.bgBlur ?? 0} min={0} max={30} step={2} suffix="px"
            onChange={v => theme.setVar('bgBlur', v)} />
        </div>
      </Modal>
    </section>
  );
}
