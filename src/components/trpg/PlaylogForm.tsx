'use client';
// 에피소드 입력 폼 — 제목과 장면 일러스트, 장면별 짧은 설명만 기록한다.
import React, { useState } from 'react';
import { EpisodeScene, PlayRecord } from '@/lib/galleryStore';
import { newId } from '@/lib/postStore';
import { KInput, KDate, KTextarea } from '@/components/ui/Kit';
import { BlobImg, putBlob } from '@/lib/blobStore';
import { useToast } from '@/components/ui/Toast';

export interface PlaylogFormValue {
  date?: string;
  scenario: string;
  summary?: string;
  scenes: EpisodeScene[];
  writer: string; withText: string; role: string; playtime: string;
  scenarioLink?: string; url?: string; logId?: string;
}

interface DraftScene extends EpisodeScene {
  file?: File;
  preview?: string;
}

function ScenePreview({ scene }: { scene: DraftScene }) {
  if (scene.preview) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={scene.preview} alt="" />;
  }
  return <BlobImg fileRef={scene.imgId} ph="" label="일러스트를 첨부하세요" />;
}

export function PlaylogForm({ initial, onSave, onCancel }: {
  initial: PlayRecord | null;
  records: PlayRecord[];
  onSave: (v: PlaylogFormValue) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const isNew = !initial;
  const [date, setDate] = useState(initial?.date ?? '');
  const [title, setTitle] = useState(initial?.scenario ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [scenes, setScenes] = useState<DraftScene[]>(() =>
    (initial?.scenes ?? []).map(scene => ({ ...scene }))
  );
  const [saving, setSaving] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const added = Array.from(files).filter(file => file.type.startsWith('image/')).map(file => ({
      id: newId(), caption: '', file, preview: URL.createObjectURL(file),
    }));
    if (added.length) setScenes(current => [...current, ...added]);
  };

  const patchScene = (id: string, patch: Partial<DraftScene>) =>
    setScenes(current => current.map(scene => scene.id === id ? { ...scene, ...patch } : scene));

  const move = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= scenes.length) return;
    setScenes(current => {
      const next = [...current];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const save = async () => {
    if (!title.trim()) { toast('에피소드 제목을 입력해 주세요'); return; }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('날짜는 YYYY-MM-DD 형식으로 입력해 주세요'); return; }
    setSaving(true);
    try {
      const savedScenes = await Promise.all(scenes.map(async scene => ({
        id: scene.id,
        imgId: scene.file ? await putBlob(scene.file) : scene.imgId,
        caption: scene.caption.trim(),
      })));
      onSave({
        date: date || undefined,
        scenario: title.trim(), summary: summary.trim() || undefined,
        scenes: savedScenes,
        writer: initial?.writer ?? '', withText: initial?.withText ?? '',
        role: initial?.role ?? '', playtime: initial?.playtime ?? '',
        scenarioLink: initial?.scenarioLink, url: initial?.url, logId: initial?.logId,
      });
    } catch {
      toast('이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요');
      setSaving(false);
    }
  };

  return (
    <div className="episode-form-layout">
      <div className="panel episode-form">
        <div className="episode-basic-fields">
          <div>
            <label className="k-label">에피소드 제목</label>
            <KInput value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 첫 번째 만남" />
          </div>
          <div>
            <label className="k-label">날짜 <span>(선택)</span></label>
            <KDate value={date} onChange={setDate} placeholder="" style={{ width: '100%' }} />
          </div>
        </div>
        <div>
          <label className="k-label">에피소드 한 줄 소개 <span>(선택)</span></label>
          <KInput value={summary} onChange={e => setSummary(e.target.value)} placeholder="이 에피소드의 전체 흐름을 짧게 적어 주세요" />
        </div>

        <div className="episode-scenes-head">
          <div>
            <b>장면 일러스트</b>
            <p>사진을 여러 장 한꺼번에 선택할 수 있고, 각 장면 아래에 설명을 달 수 있습니다.</p>
          </div>
          <label className="btn btn-dark episode-upload-btn">
            ＋ 사진 첨부
            <input type="file" accept="image/*" multiple hidden onChange={e => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }} />
          </label>
        </div>

        {scenes.length === 0 ? (
          <label className="episode-empty-drop">
            <span>＋</span>
            <b>장면 일러스트를 첨부하세요</b>
            <small>PNG · JPG · WEBP 등 이미지 파일, 여러 장 선택 가능</small>
            <input type="file" accept="image/*" multiple hidden onChange={e => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }} />
          </label>
        ) : (
          <div className="episode-scene-editor-list">
            {scenes.map((scene, index) => (
              <article className="episode-scene-editor" key={scene.id}>
                <div className="episode-scene-number">SCENE {String(index + 1).padStart(2, '0')}</div>
                <div className="episode-scene-thumb"><ScenePreview scene={scene} /></div>
                <div className="episode-scene-fields">
                  <label className="k-label">장면 설명</label>
                  <KTextarea value={scene.caption} onChange={e => patchScene(scene.id, { caption: e.target.value })}
                    placeholder="이 장면에서 무슨 일이 일어나는지 간단하게 적어 주세요" rows={3} />
                  <div className="episode-scene-actions">
                    <label className="btn btn-ghost">
                      사진 교체
                      <input type="file" accept="image/*" hidden onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) patchScene(scene.id, { file, preview: URL.createObjectURL(file) });
                        e.target.value = '';
                      }} />
                    </label>
                    <button className="btn btn-ghost" onClick={() => move(index, -1)} disabled={index === 0}>↑</button>
                    <button className="btn btn-ghost" onClick={() => move(index, 1)} disabled={index === scenes.length - 1}>↓</button>
                    <button className="btn btn-ghost" onClick={() => setScenes(current => current.filter(x => x.id !== scene.id))}>삭제</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="form-actions episode-form-actions">
        <button className="btn btn-onbk" onClick={onCancel} disabled={saving}>CANCEL</button>
        <button className="btn btn-accent" onClick={save} disabled={saving}>
          {saving ? 'UPLOADING…' : isNew ? 'ADD' : 'SAVE'}
        </button>
      </div>
    </div>
  );
}
