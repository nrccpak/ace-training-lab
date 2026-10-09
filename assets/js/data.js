/* STARTING COURSE LIST.
   Used until the Google Sheet is connected (see API_URL in config.js).
   After that, the sheet replaces this list and the admin page edits it.
   The columns of the sheet will have the same names as the fields below. */
window.ACE_DATA = {
  courses: [
    {
      id: 'ielts', name: 'IELTS Academic and General', group: 'English tests', show: true,
      short: 'Preparation for all four IELTS modules, with practice tests and feedback included.',
      level: 'Beginner to Advanced', duration: '4–6 weeks', mode: 'Online, live or recorded',
      fee: '16,000', oldFee: '32,000', image: 'course-ielts-cubes.jpg', instructor: 'aneeqa',
      learn: 'Listening: Audio practice, note-taking and understanding accents.\nReading: Skimming, scanning, paragraph matching and time management.\nWriting: Task 1 (graph or letter), Task 2 (essay), vocabulary and coherence.\nSpeaking: Fluency training, mock interviews and cue card strategy.'
    },
    {
      id: 'oet', name: 'OET for Healthcare Professionals', group: 'English tests', show: true,
      short: 'Healthcare-specific practice tailored to your profession: nursing, medicine and others.',
      level: 'Beginner to Advanced', duration: '6 weeks', mode: 'Online',
      fee: '', oldFee: '', image: 'course-oet-training.jpg', instructor: 'nouman',
      learn: 'Listening and Reading: Healthcare-specific case studies.\nWriting: Referrals and discharge summaries.\nSpeaking: Role-plays between doctor or nurse and patient.'
    },
    {
      id: 'toefl-pte', name: 'TOEFL, PTE and LangCert', group: 'English tests', show: true,
      short: 'Test-specific strategies and time-bound tasks, with 1-on-1 feedback and Q&A sessions.',
      level: 'Beginner to Advanced', duration: '4–6 weeks', mode: 'Online',
      fee: '', oldFee: '', image: 'course-toefl-student.jpg', instructor: '',
      learn: 'Content: Interactive, AI-based mock tests, grammar correction and timed drills.\nFocus: Test-specific strategies and time-bound tasks.\nSupport: 1-on-1 feedback and Q&A sessions.'
    },
    {
      id: 'spoken-english', name: 'Online Spoken English', group: 'English tests', show: true,
      short: 'Speak English fluently from anywhere, with live virtual classes and personal feedback.',
      level: 'Beginner, Intermediate, Advanced', duration: '', mode: 'Online, live',
      fee: '', oldFee: '', image: 'course-spoken-english.jpg', instructor: '',
      learn: 'Placement test: A quick online assessment places you in the right level.\nLive virtual classes: Real-time sessions with discussions, role-plays and activities.\nPersonal attention: One-on-one feedback, even in small groups.\nFlexible schedule: Lessons fit around work, studies or personal commitments.'
    },
    {
      id: 'a-o-level', name: 'A/O Level Subjects', group: 'Academic', show: true,
      short: 'Tutoring for O Level and A Level subjects under the Cambridge (CAIE) and Edexcel curricula.',
      level: 'Beginner to Advanced', duration: 'Regular, crash and revision batches', mode: 'Online',
      fee: '', oldFee: '', image: 'course-aolevel.jpg', instructor: 'ammar',
      learn: 'Subjects: English Language and Literature, Mathematics, Physics, Chemistry, Biology, Computer Science, Islamiat and Pakistan Studies.\nSupport: Topic-wise lessons, concept videos and past paper solutions.\nExam boards: Cambridge (CAIE) and Edexcel.'
    },
    {
      id: 'sat', name: 'SAT', group: 'Academic', show: true,
      short: 'Preparation for the Digital SAT Reading and Writing and Math sections.',
      level: '', duration: '', mode: 'Online',
      fee: '', oldFee: '', image: 'sat-logo.jpg', instructor: '',
      learn: 'Reading and Writing: Comprehending complex passages, words in context, grammar and argument building.\nMath: Algebra, problem-solving, data analysis and advanced math, including some geometry and trigonometry.\nTest format: Two adaptive modules per section, scored on a 1600-point scale.'
    },
    {
      id: 'quran', name: 'Quran Classes with Tajweed', group: 'Quran', show: true,
      short: 'Recitation, Tajweed, Tafsir and memorization for all ages, with flexible timing.',
      level: 'Beginner to Advanced', duration: 'Flexible for kids and adults', mode: 'Online',
      fee: '', oldFee: '', image: 'course-quran.jpg', instructor: 'ifrah',
      learn: 'Qaida (basics): Arabic letters, sounds and joining words.\nTajweed rules: Makharij, Madd, Ikhfa, Idghaam and more.\nTafsir and translation: Understanding Quranic meanings.\nMemorization: Short surahs and Juz Amma.'
    }
  ],

  /* Upcoming batches. One line per batch, for example:
     { courseId: 'ielts', start: '2026-11-02', time: '10:00 AM', seats: 5 } */
  batches: []
};

/* Instructors (shown on the About page and on course pages). */
window.ACE_INSTRUCTORS = {
  aneeqa: { name: 'Ms. Aneeqa Sultana', role: 'IELTS', photo: 'instructor-aneeqa.jpg', bio: 'Over 8 years of experience and multiple British Council certifications. Has helped 500+ students reach their IELTS scores.' },
  nouman: { name: 'Dr. Nouman Tariq', role: 'OET', photo: 'instructor-nouman.jpg', bio: 'MBBS doctor who has cleared USMLE and trained 700+ students for OET.' },
  ammar: { name: 'Mr. Ammar', role: 'O/A Level Math and Physics', photo: 'instructor-ammar.jpg', bio: 'An engineer by qualification who has taught at leading schools, with a track record of A* results.' },
  ifrah: { name: 'Ifrah Tariq', role: 'Quran and Tajweed', photo: 'instructor-ifrah.jpg', bio: 'Specialises in Tajweed and Quranic interpretation, with over 12 years of teaching experience.' }
};
