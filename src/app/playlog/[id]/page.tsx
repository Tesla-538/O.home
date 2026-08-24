'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { BlobImg } from '@/lib/blobStore';

export default function EpisodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [records, , loaded] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);
  const record = records.find(item => item.id === id);

  if (!loaded) return <section className="page" />;
  if (!record) return (
    <section className="page">
      <div className="panel episode-list-empty">에피소드를 찾을 수 없습니다.</div>
    </section>
  );

  return (
    <section className="page episode-detail-page">
      <div className="episode-detail-head">
        <button className="btn btn-onbk" onClick={() => router.push('/playlog')}>‹ 목록</button>
        <div>
          {record.date && <time>{record.date.replace(/-/g, '.')}</time>}
          <h1>{record.scenario}</h1>
          {record.summary && <p>{record.summary}</p>}
        </div>
        {isAdmin && <button className="btn btn-dark" onClick={() => router.push(`/playlog/${record.id}/edit`)}>EDIT</button>}
      </div>

      {(record.scenes ?? []).length ? (
        <div className="episode-scene-view-list">
          {record.scenes!.map((scene, index) => (
            <figure className="panel episode-scene-view" key={scene.id}>
              <div className="episode-scene-view-label">SCENE {String(index + 1).padStart(2, '0')}</div>
              {scene.imgId && <div className="episode-scene-view-art"><BlobImg fileRef={scene.imgId} alt={`${record.scenario} 장면 ${index + 1}`} imgStyle={{ objectFit: 'contain' }} /></div>}
              {scene.caption && <figcaption>{scene.caption}</figcaption>}
            </figure>
          ))}
        </div>
      ) : (
        <div className="panel episode-list-empty">아직 등록된 장면이 없습니다.</div>
      )}
    </section>
  );
}
