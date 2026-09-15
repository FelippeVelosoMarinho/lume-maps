import { createElement } from 'react'
import MDEditor, { commands, type ICommand } from '@uiw/react-md-editor'
import { Eye, Pencil } from 'lucide-react'
import { SUBTITLE_MAX_LENGTH } from '../lib/markdown'
import '@uiw/react-md-editor/markdown-editor.css'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  /** Altura da área de edição (px) */
  height?: number
}

const TOOLBAR = [
  commands.bold,
  commands.italic,
  commands.divider,
  commands.link,
  commands.unorderedListCommand,
  commands.orderedListCommand,
]

const editCommand: ICommand = {
  ...commands.codeEdit,
  icon: createElement(Pencil, { size: 14, strokeWidth: 2 }),
  buttonProps: {
    'aria-label': 'Editar',
    title: 'Editar',
  },
}

const previewCommand: ICommand = {
  ...commands.codePreview,
  icon: createElement(Eye, { size: 14, strokeWidth: 2 }),
  buttonProps: {
    'aria-label': 'Visualizar',
    title: 'Visualizar',
  },
}

export function MarkdownField({
  value,
  onChange,
  placeholder = 'Descreva a viagem com negrito, itálico e links…',
  maxLength = SUBTITLE_MAX_LENGTH,
  height = 160,
}: Props) {
  const len = value.length
  const over = len > maxLength

  return (
    <div className="markdown-field mt-1" data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(v) => onChange((v ?? '').slice(0, maxLength))}
        height={height}
        preview="edit"
        visibleDragbar={false}
        textareaProps={{
          placeholder,
          maxLength,
        }}
        commands={TOOLBAR}
        extraCommands={[editCommand, previewCommand]}
      />
      <p className={`mt-1 text-[10px] text-right ${over ? 'text-red-800' : 'text-earth/60'}`}>
        {len}/{maxLength} · markdown
      </p>
    </div>
  )
}
