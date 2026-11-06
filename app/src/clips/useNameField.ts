import type { ChangeEvent, FocusEvent, FormEvent, KeyboardEvent } from 'react'
import { useState } from 'react'

/* #54. What a field renaming a clip does, wherever it is drawn: the tile asks
   over its poster and the player asks in its header, and the two must not
   disagree about what counts as a name. The markup stays with each caller,
   because the two look nothing alike.

   Mounted for exactly as long as the question is open, so what was typed lives
   that long and no longer: cancel it, open it again, and it starts from the
   clip's name rather than from the name that was thrown away. */
export const useNameField = ({
  name,
  onSave,
  onCancel,
}: {
  readonly name: string
  /* Handed the name already trimmed, and only when it is new. */
  readonly onSave: (name: string) => void
  readonly onCancel: () => void
}) => {
  const [typed, setTyped] = useState(name)
  const wanted = typed.trim()

  return {
    /* For the Save control to be disabled by, rather than refused after the
       fact: a clip with no name has nothing on its tile to be found by. */
    canSave: wanted !== '',
    form: {
      onSubmit: (event: FormEvent) => {
        event.preventDefault()

        /* Saving the name it already has is closing the question, and asks
           Drive nothing. */
        if (wanted === name) onCancel()
        else onSave(wanted)
      },
    },
    field: {
      value: typed,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        setTyped(event.target.value)
      },
      /* Selected on arrival, because a rename is nearly always a whole new
         name, and a caret at the end would make every one of them start with a
         select-all. */
      onFocus: (event: FocusEvent<HTMLInputElement>) => {
        event.currentTarget.select()
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Escape') onCancel()
      },
      autoFocus: true,
    },
  }
}
