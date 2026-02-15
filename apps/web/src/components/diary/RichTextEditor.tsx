"use client";

import { useState, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  LinkIcon,
  Code,
  Undo,
  Redo,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Tiptap-based rich text editor with floating toolbar.
 * Stores content as HTML.
 */
export function RichTextEditor({
  content,
  onChange,
  placeholder = "Write your diary entry...",
  className,
  disabled = false,
}: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2 cursor-pointer",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[120px] max-h-[400px] overflow-y-auto p-3 rounded-md border border-input bg-background",
          "text-sm ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "prose prose-sm dark:prose-invert max-w-none",
          "[&_.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.is-editor-empty:first-child::before]:float-left",
          "[&_.is-editor-empty:first-child::before]:h-0",
          "[&_.is-editor-empty:first-child::before]:pointer-events-none",
          disabled && "opacity-50 cursor-not-allowed"
        ),
      },
    },
  });

  // Sync content when editing an existing entry
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentHTML = editor.getHTML();
      // Only update if the content actually changed externally
      if (currentHTML !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  const applyLink = () => {
    const url = linkUrl.trim();
    if (url) {
      const href = url.match(/^https?:\/\//) ? url : `https://${url}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setLinkUrl("");
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setLinkUrl("");
    setLinkOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      {/* Static toolbar */}
      <div className="flex items-center gap-0.5 mb-2 flex-wrap">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <Popover open={linkOpen} onOpenChange={(open) => {
          setLinkOpen(open);
          if (open) {
            // Pre-fill with existing link URL
            const existingHref = editor.getAttributes("link").href || "";
            setLinkUrl(existingHref);
            setTimeout(() => linkInputRef.current?.focus(), 100);
          }
        }}>
          <PopoverTrigger asChild>
            <ToolbarButton
              active={editor.isActive("link")}
              onClick={() => setLinkOpen(!linkOpen)}
              title="Link"
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="flex items-center gap-1.5">
              <Input
                ref={linkInputRef}
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                  if (e.key === "Escape") {
                    setLinkOpen(false);
                  }
                }}
                className="h-8 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={applyLink}
                disabled={!linkUrl.trim()}
                title="Apply link"
              >
                <Check className="h-4 w-4" />
              </Button>
              {editor.isActive("link") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive"
                  onClick={removeLink}
                  title="Remove link"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor content area */}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8",
        active && "bg-accent text-accent-foreground"
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}
