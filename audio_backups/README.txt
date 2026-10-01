Original audio files kept before processing (outside game/ so they are not
bundled into builds).

age_question.original.mp3
  The shipped game/audio/chapter1/scene1/sophie/age_question.mp3 was made from
  this with:
    ffmpeg -i age_question.original.mp3 \
      -af "afade=t=in:st=0:d=0.15:curve=qsin,adelay=150:all=1" \
      -ar 44100 -ac 1 -b:a 128k age_question.mp3
  The original starts ~24 ms in with an instant jump to high volume (heard as a
  click/crack). The fix adds 150 ms of lead-in silence and a short fade-in.
