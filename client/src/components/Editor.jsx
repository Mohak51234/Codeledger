import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';

// Exposes setCode(code) so the parent (EditorPage) can push
// server-authoritative content in — used on initial join and whenever
// the server rejects a stale write and sends back the true state.
const Editor = forwardRef(({ onLocalChange }, ref) => {
    const editorRef = useRef(null);
    const applyingRemote = useRef(false);

    useImperativeHandle(ref, () => ({
        setCode(code) {
            if (!editorRef.current) return;
            applyingRemote.current = true;
            const cursor = editorRef.current.getCursor();
            editorRef.current.setValue(code ?? '');
            editorRef.current.setCursor(cursor);
            applyingRemote.current = false;
        },
    }));

    useEffect(() => {
        editorRef.current = Codemirror.fromTextArea(
            document.getElementById('realtimeEditor'),
            {
                mode: { name: 'javascript', json: true },
                theme: 'dracula',
                autoCloseTags: true,
                autoCloseBrackets: true,
                lineNumbers: true,
            }
        );

        editorRef.current.on('change', (instance) => {
            if (applyingRemote.current) return; // don't re-emit remote-origin writes
            onLocalChange(instance.getValue());
        });

        return () => editorRef.current?.toTextArea();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <textarea id="realtimeEditor" />;
});

export default Editor;