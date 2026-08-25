'use client';
// 리치 텍스트 에디터 (TipTap) — 프로필 탭 등 HTML 콘텐츠 작성용
// 자체 스타일 툴바 (7장 — 기본 UI 금지) · 출력은 HTML, 저장 시 새니타이즈는 렌더 쪽에서 (6.3)
import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { putBlob } from '@/lib/blobStore';
import { useToast } from '@/components/ui/Toast';

function TBtn({ on, label, title, onClick, disabled, className = '' }: {
  on?: boolean; label: React.ReactNode; title: string; onClick: () => void;
  disabled?: boolean; className?: string;
}) {
  return (
    <button type="button" data-tip={title} aria-label={title} disabled={disabled}
      className={`re-btn ${on ? 'on' : ''} ${className}`.trim()}
      onMouseDown={e => e.preventDefault()} onClick={onClick}>
      {label}
    </button>
  );
}

export function RichEditor({ value, onChange, placeholder }: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const toast = useToast();
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: value || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 're-content prose' },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // 외부 값이 완전히 바뀐 경우(탭 전환) 동기화
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return <div className="re-wrap" style={{ minHeight: 200 }} />;

  const addImage = () => {
    const url = window.prompt('이미지 URL을 입력하세요');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const uploadImages = async (files: FileList | null) => {
    const selected = Array.from(files ?? []);
    const images = selected.filter(file => file.type.startsWith('image/'));
    if (!images.length) {
      if (selected.length) toast('이미지 파일만 첨부할 수 있습니다');
      return;
    }
    setImageUploading(true);
    try {
      for (const file of images) {
        const src = await putBlob(file);
        editor.chain().focus().setImage({ src, alt: file.name }).run();
      }
      toast(images.length > 1 ? `이미지 ${images.length}장을 본문에 삽입했습니다` : '이미지를 본문에 삽입했습니다');
    } catch (error) {
      console.error('RichEditor image upload failed', error);
      toast('이미지 업로드에 실패했습니다 — 잠시 후 다시 시도해 주세요');
    } finally {
      setImageUploading(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  };

  return (
    <div className="re-wrap">
      <div className="re-toolbar">
        <TBtn title="굵게" label={<b>B</b>} on={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()} />
        <TBtn title="기울임" label={<i>I</i>} on={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()} />
        <TBtn title="취소선" label={<s>S</s>} on={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()} />
        <span className="re-sep" />
        <TBtn title="제목" label="H2" on={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <TBtn title="소제목" label="H3" on={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="re-sep" />
        <TBtn title="글머리 목록" label="•≡" on={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <TBtn title="번호 목록" label="1≡" on={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <TBtn title="인용" label="❝" on={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <TBtn title="구분선" label="—" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <span className="re-sep" />
        <TBtn title="이미지 URL로 삽입" label="🔗" onClick={addImage} />
        <TBtn title="내 기기에서 이미지 파일 첨부" className="re-upload-btn"
          disabled={imageUploading}
          label={<><span aria-hidden>▧</span><span>{imageUploading ? '업로드 중' : '이미지 파일'}</span></>}
          onClick={() => imageFileRef.current?.click()} />
        <input ref={imageFileRef} className="re-file-input" type="file" accept="image/*" multiple
          aria-label="본문에 첨부할 이미지 파일 선택"
          onChange={e => void uploadImages(e.target.files)} />
        {/* 실행 취소·다시 실행은 모바일에서 숨김 — 툴바가 두 줄로 넘어가 본문 영역을 침범 (v1.9 사용자 확정)
            (단축키 Ctrl+Z / Ctrl+Shift+Z는 그대로 동작) */}
        <span className="re-sep re-hide-m" />
        <span className="re-hide-m" style={{ display: 'contents' }}>
          <TBtn title="실행 취소" label="↶" onClick={() => editor.chain().focus().undo().run()} />
          <TBtn title="다시 실행" label="↷" onClick={() => editor.chain().focus().redo().run()} />
        </span>
      </div>
      {/* 플레이스홀더는 본문 영역 기준으로 — 툴바가 두 줄이 돼도 안 밀림 (v1.9 사용자 발견) */}
      <div className="re-body">
        <EditorContent editor={editor} />
        {placeholder && editor.isEmpty && <div className="re-ph">{placeholder}</div>}
      </div>
    </div>
  );
}
