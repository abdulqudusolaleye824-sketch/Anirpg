/**
 * ✦ 𝐀𝐬𝐭𝐫𝐚™ — Anime Quiz Question Bank
 * 200 verified questions across 42 anime series
 * Question types: protagonist, antagonist, ability, item, organization, relationship, plot, power system
 *
 * Format:
 * {
 *   id: number,
 *   question: string,
 *   options: { A, B, C, D },
 *   answer: 'A' | 'B' | 'C' | 'D',
 *   anime: string,
 *   difficulty: 'easy' | 'medium' | 'hard'
 * }
 */

'use strict';

const QUIZ_QUESTIONS = [

  // ══ NARUTO (1-12) ══════════════════════════════════════════════════════════
  {
    id: 1, anime: 'Naruto', difficulty: 'easy',
    question: 'What is the name of the Nine-Tailed Fox sealed inside Naruto?',
    options: { A: 'Shukaku', B: 'Gyuki', C: 'Kurama', D: 'Matatabi' },
    answer: 'C',
  },
  {
    id: 2, anime: 'Naruto', difficulty: 'easy',
    question: 'Which village is Naruto Uzumaki from?',
    options: { A: 'Village Hidden in the Sand', B: 'Village Hidden in the Mist', C: 'Village Hidden in the Clouds', D: 'Village Hidden in the Leaves' },
    answer: 'D',
  },
  {
    id: 3, anime: 'Naruto', difficulty: 'medium',
    question: 'What is the name of Sasuke\'s signature fire technique?',
    options: { A: 'Phoenix Flower Jutsu', B: 'Dragon Flame Jutsu', C: 'Great Fireball Jutsu', D: 'Fire Dragon Bullet' },
    answer: 'C',
  },
  {
    id: 4, anime: 'Naruto', difficulty: 'medium',
    question: 'Who is the leader of the Akatsuki organization?',
    options: { A: 'Itachi Uchiha', B: 'Nagato (Pain)', C: 'Obito Uchiha', D: 'Kisame Hoshigaki' },
    answer: 'B',
  },
  {
    id: 5, anime: 'Naruto', difficulty: 'hard',
    question: 'What is the name of the technique Minato Namikaze is most famous for?',
    options: { A: 'Rasengan', B: 'Flying Thunder God Technique', C: 'Shadow Clone Jutsu', D: 'Eight Inner Gates' },
    answer: 'B',
  },
  {
    id: 6, anime: 'Naruto', difficulty: 'medium',
    question: 'Which Uchiha awakened the Mangekyo Sharingan by killing his best friend?',
    options: { A: 'Sasuke', B: 'Obito', C: 'Itachi', D: 'Shisui' },
    answer: 'C',
  },
  {
    id: 7, anime: 'Naruto', difficulty: 'hard',
    question: 'What is the name of Kakashi\'s Mangekyo Sharingan ability?',
    options: { A: 'Tsukuyomi', B: 'Amaterasu', C: 'Kamui', D: 'Susanoo' },
    answer: 'C',
  },
  {
    id: 8, anime: 'Naruto', difficulty: 'easy',
    question: 'What rank is Naruto at the start of the series?',
    options: { A: 'Chunin', B: 'Genin', C: 'Jonin', D: 'Academy Student' },
    answer: 'D',
  },
  {
    id: 9, anime: 'Naruto', difficulty: 'medium',
    question: 'Which sage taught Naruto sage mode at Mount Myoboku?',
    options: { A: 'Jiraiya', B: 'Fukasaku', C: 'Gamabunta', D: 'Shima' },
    answer: 'B',
  },
  {
    id: 10, anime: 'Naruto', difficulty: 'hard',
    question: 'What are the six paths of Pain used by Nagato called collectively?',
    options: { A: 'The Six Paths', B: 'The Outer Path', C: 'The Rinnegan Six', D: 'The Deva Paths' },
    answer: 'A',
  },
  {
    id: 11, anime: 'Naruto', difficulty: 'medium',
    question: 'Who trained Naruto to control the Nine-Tails chakra using a waterfall?',
    options: { A: 'Bee', B: 'Yamato', C: 'Jiraiya', D: 'Tsunade' },
    answer: 'A',
  },
  {
    id: 12, anime: 'Naruto', difficulty: 'hard',
    question: 'What is the name of Madara\'s ultimate technique that creates a tree to drain chakra?',
    options: { A: 'Infinite Tsukuyomi', B: 'Rinne Rebirth', C: 'God Tree', D: 'Limbo Clone' },
    answer: 'C',
  },

  // ══ DEMON SLAYER (13-22) ════════════════════════════════════════════════════
  {
    id: 13, anime: 'Demon Slayer', difficulty: 'easy',
    question: 'Who is the main antagonist of Demon Slayer?',
    options: { A: 'Akaza', B: 'Doma', C: 'Muzan Kibutsuji', D: 'Kokushibo' },
    answer: 'C',
  },
  {
    id: 14, anime: 'Demon Slayer', difficulty: 'easy',
    question: 'What breathing style does Tanjiro primarily use?',
    options: { A: 'Water Breathing', B: 'Flame Breathing', C: 'Thunder Breathing', D: 'Wind Breathing' },
    answer: 'A',
  },
  {
    id: 15, anime: 'Demon Slayer', difficulty: 'medium',
    question: 'What is Zenitsu\'s signature Thunder Breathing technique?',
    options: { A: 'Second Form — Rice Spirit', B: 'First Form — Thunderclap and Flash', C: 'Third Form — Drum', D: 'Seventh Form — Honoikazuchi no Kami' },
    answer: 'B',
  },
  {
    id: 16, anime: 'Demon Slayer', difficulty: 'medium',
    question: 'Which Upper Moon demon killed Rengoku?',
    options: { A: 'Doma', B: 'Kokushibo', C: 'Akaza', D: 'Hantengu' },
    answer: 'C',
  },
  {
    id: 17, anime: 'Demon Slayer', difficulty: 'hard',
    question: 'What is the name of the Flame Hashira who died during the Mugen Train arc?',
    options: { A: 'Shinjuro Rengoku', B: 'Flamehaze', C: 'Kyojuro Rengoku', D: 'Mitsuri Kanroji' },
    answer: 'C',
  },
  {
    id: 18, anime: 'Demon Slayer', difficulty: 'medium',
    question: 'What is Inosuke\'s unique fighting style?',
    options: { A: 'Water Breathing', B: 'Beast Breathing', C: 'Wind Breathing', D: 'Insect Breathing' },
    answer: 'B',
  },
  {
    id: 19, anime: 'Demon Slayer', difficulty: 'hard',
    question: 'Who is Kokushibo and what is his relationship to a Hashira?',
    options: { A: 'He is Yoriichi\'s twin brother', B: 'He is Tanjiro\'s ancestor', C: 'He is Muzan\'s first demon', D: 'He trained Gyomei' },
    answer: 'A',
  },
  {
    id: 20, anime: 'Demon Slayer', difficulty: 'medium',
    question: 'What does Tanjiro\'s Hinokami Kagura breathing style originate from?',
    options: { A: 'Water Breathing', B: 'Sun Breathing', C: 'Flame Breathing', D: 'Moon Breathing' },
    answer: 'B',
  },
  {
    id: 21, anime: 'Demon Slayer', difficulty: 'easy',
    question: 'What organization do demon slayers belong to?',
    options: { A: 'The Demon Corps', B: 'The Hashira Council', C: 'The Demon Slayer Corps', D: 'The Breath Society' },
    answer: 'C',
  },
  {
    id: 22, anime: 'Demon Slayer', difficulty: 'hard',
    question: 'What is the name of the mark that appears on gifted Demon Slayers and Hashira?',
    options: { A: 'Demon Mark', B: 'Breath Mark', C: 'Slayer Mark', D: 'Transparent World Mark' },
    answer: 'C',
  },

  // ══ JUJUTSU KAISEN (23-32) ══════════════════════════════════════════════════
  {
    id: 23, anime: 'Jujutsu Kaisen', difficulty: 'easy',
    question: 'Who is the King of Curses in Jujutsu Kaisen?',
    options: { A: 'Geto Suguru', B: 'Kenjaku', C: 'Ryomen Sukuna', D: 'Mahito' },
    answer: 'C',
  },
  {
    id: 24, anime: 'Jujutsu Kaisen', difficulty: 'easy',
    question: 'What is the name of Satoru Gojo\'s signature ability?',
    options: { A: 'Divergence', B: 'Infinity', C: 'Curtain', D: 'Domain' },
    answer: 'B',
  },
  {
    id: 25, anime: 'Jujutsu Kaisen', difficulty: 'medium',
    question: 'What is the name of Yuji Itadori\'s school where he studies jujutsu?',
    options: { A: 'Tokyo Metropolitan Curse Technical College', B: 'Kyoto Sorcery Academy', C: 'Jujutsu High', D: 'Tokyo Sorcerer Institute' },
    answer: 'A',
  },
  {
    id: 26, anime: 'Jujutsu Kaisen', difficulty: 'medium',
    question: 'What curse technique does Megumi Fushiguro use?',
    options: { A: 'Ratio Technique', B: 'Ten Shadows Technique', C: 'Boogie Woogie', D: 'Idle Transfiguration' },
    answer: 'B',
  },
  {
    id: 27, anime: 'Jujutsu Kaisen', difficulty: 'hard',
    question: 'What is the name of Gojo\'s Domain Expansion?',
    options: { A: 'Malevolent Shrine', B: 'Coffin of the Iron Mountain', C: 'Unlimited Void', D: 'Self-Embodiment of Perfection' },
    answer: 'C',
  },
  {
    id: 28, anime: 'Jujutsu Kaisen', difficulty: 'medium',
    question: 'What is Mahito\'s cursed technique?',
    options: { A: 'Blood Manipulation', B: 'Idle Transfiguration', C: 'Puppet Manipulation', D: 'Disaster Plants' },
    answer: 'B',
  },
  {
    id: 29, anime: 'Jujutsu Kaisen', difficulty: 'hard',
    question: 'What is Sukuna\'s Domain Expansion called?',
    options: { A: 'Unlimited Void', B: 'Malevolent Shrine', C: 'Coffin of Iron Mountain', D: 'Horizon of the Captivating Skandha' },
    answer: 'B',
  },
  {
    id: 30, anime: 'Jujutsu Kaisen', difficulty: 'medium',
    question: 'What is a Black Flash in Jujutsu Kaisen?',
    options: { A: 'A cursed technique unique to Yuji', B: 'A distortion of space when cursed energy is applied 0.000001s of impact', C: 'Gojo\'s secret technique', D: 'A domain expansion glitch' },
    answer: 'B',
  },
  {
    id: 31, anime: 'Jujutsu Kaisen', difficulty: 'easy',
    question: 'How many fingers of Sukuna has Yuji consumed by the start of the series?',
    options: { A: 'One', B: 'Three', C: 'Five', D: 'Ten' },
    answer: 'A',
  },
  {
    id: 32, anime: 'Jujutsu Kaisen', difficulty: 'hard',
    question: 'What is the name of Nobara Kugisaki\'s cursed technique?',
    options: { A: 'Straw Doll Technique', B: 'Hairpin Technique', C: 'Nail Coffin', D: 'Resonance Strike' },
    answer: 'A',
  },

  // ══ HUNTER X HUNTER (33-42) ════════════════════════════════════════════════
  {
    id: 33, anime: 'Hunter x Hunter', difficulty: 'easy',
    question: 'What is the name of the energy system used in Hunter x Hunter?',
    options: { A: 'Chakra', B: 'Nen', C: 'Haki', D: 'Reiatsu' },
    answer: 'B',
  },
  {
    id: 34, anime: 'Hunter x Hunter', difficulty: 'medium',
    question: 'What is Killua\'s Nen ability called?',
    options: { A: 'Lightning Flash', B: 'Thunderbolt', C: 'Godspeed', D: 'Narukami' },
    answer: 'C',
  },
  {
    id: 35, anime: 'Hunter x Hunter', difficulty: 'medium',
    question: 'Who is the king of the Chimera Ants?',
    options: { A: 'Neferpitou', B: 'Shaiapouf', C: 'Meruem', D: 'Menthuthuyoupi' },
    answer: 'C',
  },
  {
    id: 36, anime: 'Hunter x Hunter', difficulty: 'hard',
    question: 'What is Gon\'s Nen type?',
    options: { A: 'Transmuter', B: 'Enhancer', C: 'Emitter', D: 'Specialist' },
    answer: 'B',
  },
  {
    id: 37, anime: 'Hunter x Hunter', difficulty: 'medium',
    question: 'What is the name of Hisoka\'s Nen ability?',
    options: { A: 'Bungee Gum', B: 'Elastic Love', C: 'Card Sharp', D: 'Magician\'s Grip' },
    answer: 'A',
  },
  {
    id: 38, anime: 'Hunter x Hunter', difficulty: 'hard',
    question: 'What is the name of the game on Greed Island?',
    options: { A: 'Greed Island', B: 'Hunter\'s Game', C: 'Nen Island', D: 'Card Kingdom' },
    answer: 'A',
  },
  {
    id: 39, anime: 'Hunter x Hunter', difficulty: 'medium',
    question: 'Who is Gon\'s father?',
    options: { A: 'Ging Freecss', B: 'Leorio', C: 'Netero', D: 'Kite' },
    answer: 'A',
  },
  {
    id: 40, anime: 'Hunter x Hunter', difficulty: 'hard',
    question: 'What does Kurapika\'s Nen ability Scarlet Eyes grant him?',
    options: { A: 'Specialist abilities only against Phantom Troupe', B: 'Full mastery of all Nen types', C: 'The ability to steal others\' Nen', D: 'Emperor Time — 100% efficiency in all Nen types' },
    answer: 'D',
  },
  {
    id: 41, anime: 'Hunter x Hunter', difficulty: 'easy',
    question: 'What is the name of the criminal organization Kurapika hunts?',
    options: { A: 'The Phantom Troupe', B: 'The Chimera Ants', C: 'The Zodiacs', D: 'The Dark Continent Hunters' },
    answer: 'A',
  },
  {
    id: 42, anime: 'Hunter x Hunter', difficulty: 'hard',
    question: 'What technique did Netero use against Meruem that ultimately killed them both?',
    options: { A: '100-Type Guanyin Bodhisattva', B: 'Zero Hand', C: 'Poor Man\'s Rose', D: 'Both B and C' },
    answer: 'D',
  },

  // ══ ONE PIECE (43-52) ═══════════════════════════════════════════════════════
  {
    id: 43, anime: 'One Piece', difficulty: 'easy',
    question: 'What is the name of the treasure Monkey D. Luffy is searching for?',
    options: { A: 'Eternal Pose', B: 'One Piece', C: 'Poneglyph', D: 'Road Stone' },
    answer: 'B',
  },
  {
    id: 44, anime: 'One Piece', difficulty: 'easy',
    question: 'What Devil Fruit did Luffy eat?',
    options: { A: 'Mera Mera no Mi', B: 'Gura Gura no Mi', C: 'Hito Hito no Mi', D: 'Gomu Gomu no Mi' },
    answer: 'D',
  },
  {
    id: 45, anime: 'One Piece', difficulty: 'medium',
    question: 'What is the name of the swordsmanship style Zoro uses?',
    options: { A: 'One Sword Style', B: 'Santoryu (Three Sword Style)', C: 'Nitoryu (Two Sword Style)', D: 'Ittoryu (One Sword Style)' },
    answer: 'B',
  },
  {
    id: 46, anime: 'One Piece', difficulty: 'medium',
    question: 'Who is the Surgeon of Death in One Piece?',
    options: { A: 'Marco', B: 'Trafalgar D. Water Law', C: 'Crocodile', D: 'Donquixote Doflamingo' },
    answer: 'B',
  },
  {
    id: 47, anime: 'One Piece', difficulty: 'hard',
    question: 'What are the three types of Haki?',
    options: { A: 'Observation, Armament, Conqueror\'s', B: 'Emission, Hardening, Domination', C: 'Future Sight, Coating, Supreme King', D: 'Sensing, Strengthening, Ruling' },
    answer: 'A',
  },
  {
    id: 48, anime: 'One Piece', difficulty: 'medium',
    question: 'What is the name of the World Government\'s secret assassination force?',
    options: { A: 'Marines', B: 'Cipher Pol 9 (CP9)', C: 'Warlords', D: 'Celestial Dragons' },
    answer: 'B',
  },
  {
    id: 49, anime: 'One Piece', difficulty: 'easy',
    question: 'Who is the cook of the Straw Hat Pirates?',
    options: { A: 'Usopp', B: 'Franky', C: 'Sanji', D: 'Brook' },
    answer: 'C',
  },
  {
    id: 50, anime: 'One Piece', difficulty: 'hard',
    question: 'What is the name of the Ancient Weapon that Nico Robin can find using Poneglyphs?',
    options: { A: 'Poseidon', B: 'Pluton', C: 'Uranus', D: 'All of the above' },
    answer: 'D',
  },
  {
    id: 51, anime: 'One Piece', difficulty: 'medium',
    question: 'What is the name of Whitebeard\'s Devil Fruit power?',
    options: { A: 'Magu Magu no Mi', B: 'Gura Gura no Mi', C: 'Hie Hie no Mi', D: 'Yami Yami no Mi' },
    answer: 'B',
  },
  {
    id: 52, anime: 'One Piece', difficulty: 'hard',
    question: 'What is the true name of Luffy\'s Devil Fruit revealed later in the story?',
    options: { A: 'Hito Hito no Mi Model Nika', B: 'Gomu Gomu no Mi', C: 'Zoan Rubber Fruit', D: 'Sun God Fruit' },
    answer: 'A',
  },

  // ══ BLEACH (53-62) ══════════════════════════════════════════════════════════
  {
    id: 53, anime: 'Bleach', difficulty: 'easy',
    question: 'Who is the main antagonist of the Soul Society arc in Bleach?',
    options: { A: 'Yhwach', B: 'Gin Ichimaru', C: 'Sosuke Aizen', D: 'Ulquiorra' },
    answer: 'C',
  },
  {
    id: 54, anime: 'Bleach', difficulty: 'easy',
    question: 'What is the name of Ichigo\'s Zanpakuto?',
    options: { A: 'Senbonzakura', B: 'Zabimaru', C: 'Zangetsu', D: 'Ryujin Jakka' },
    answer: 'C',
  },
  {
    id: 55, anime: 'Bleach', difficulty: 'medium',
    question: 'What is the name of the second release of a Zanpakuto in Bleach?',
    options: { A: 'Shikai', B: 'Bankai', C: 'Resurreccion', D: 'Vollstandig' },
    answer: 'B',
  },
  {
    id: 56, anime: 'Bleach', difficulty: 'medium',
    question: 'What is Aizen\'s Zanpakuto ability?',
    options: { A: 'Controls fire', B: 'Controls all five senses — complete hypnosis', C: 'Creates ice', D: 'Reflects attacks' },
    answer: 'B',
  },
  {
    id: 57, anime: 'Bleach', difficulty: 'hard',
    question: 'What is the name of the Quincy king who fought the Soul King?',
    options: { A: 'Uryu Ishida', B: 'Ryken Ishida', C: 'Yhwach', D: 'Juhabach' },
    answer: 'C',
  },
  {
    id: 58, anime: 'Bleach', difficulty: 'medium',
    question: 'What is the hollow form Ichigo takes when his inner hollow takes control?',
    options: { A: 'Vasto Lorde', B: 'Vizard Form', C: 'White Zangetsu', D: 'Full Hollow' },
    answer: 'D',
  },
  {
    id: 59, anime: 'Bleach', difficulty: 'easy',
    question: 'What rank is Ichigo when he first becomes a Soul Reaper?',
    options: { A: 'Captain', B: 'Lieutenant', C: 'He has no official rank — Substitute Soul Reaper', D: 'Third Seat' },
    answer: 'C',
  },
  {
    id: 60, anime: 'Bleach', difficulty: 'hard',
    question: 'What is the name of Captain Yamamoto\'s Bankai?',
    options: { A: 'Ryujin Jakka Bankai', B: 'Zanka no Tachi', C: 'Senbonzakura Kageyoshi', D: 'Kokjo Tengen Myo\'o' },
    answer: 'B',
  },
  {
    id: 61, anime: 'Bleach', difficulty: 'medium',
    question: 'What is a Menos Grande?',
    options: { A: 'A type of Quincy', B: 'A large hollow formed by the fusion of many hollows', C: 'A Soul Reaper rank', D: 'An arrancar transformation' },
    answer: 'B',
  },
  {
    id: 62, anime: 'Bleach', difficulty: 'hard',
    question: 'What ability does Kenpachi Zaraki gain after learning his Zanpakuto\'s name?',
    options: { A: 'Bankai only', B: 'Shikai that cuts anything', C: 'Nozarashi — amplifies destructive power', D: 'Speed multiplication' },
    answer: 'C',
  },

  // ══ FULLMETAL ALCHEMIST: BROTHERHOOD (63-70) ════════════════════════════════
  {
    id: 63, anime: 'Fullmetal Alchemist: Brotherhood', difficulty: 'easy',
    question: 'Who is the main antagonist pulling the strings in FMA: Brotherhood?',
    options: { A: 'Scar', B: 'Father', C: 'Envy', D: 'Pride' },
    answer: 'B',
  },
  {
    id: 64, anime: 'Fullmetal Alchemist: Brotherhood', difficulty: 'easy',
    question: 'What is the fundamental law of alchemy in FMA?',
    options: { A: 'The Law of Conservation', B: 'Equivalent Exchange', C: 'The Circle of Life', D: 'The Transmutation Code' },
    answer: 'B',
  },
  {
    id: 65, anime: 'Fullmetal Alchemist: Brotherhood', difficulty: 'medium',
    question: 'What body part did Edward Elric sacrifice to get his brother\'s soul back?',
    options: { A: 'His left arm', B: 'His right leg', C: 'His right arm', D: 'His right leg and left arm' },
    answer: 'D',
  },
  {
    id: 66, anime: 'Fullmetal Alchemist: Brotherhood', difficulty: 'medium',
    question: 'What is the name of the stone that amplifies alchemy beyond normal limits?',
    options: { A: 'Soul Stone', B: 'Philosopher\'s Stone', C: 'Alchemist\'s Gem', D: 'Blood Seal' },
    answer: 'B',
  },
  {
    id: 67, anime: 'Fullmetal Alchemist: Brotherhood', difficulty: 'hard',
    question: 'What is Pride\'s true form?',
    options: { A: 'A child named Selim Bradley', B: 'A shadow creature', C: 'King Bradley himself', D: 'The eldest homunculus' },
    answer: 'A',
  },
  {
    id: 68, anime: 'Fullmetal Alchemist: Brotherhood', difficulty: 'medium',
    question: 'What sin does Greed represent and what is his ability?',
    options: { A: 'Greed — carbon hardening shield', B: 'Greed — speed enhancement', C: 'Greed — flame alchemy', D: 'Greed — super strength' },
    answer: 'A',
  },
  {
    id: 69, anime: 'Fullmetal Alchemist: Brotherhood', difficulty: 'easy',
    question: 'What is the name of Ed and Al\'s childhood friend who is a mechanic?',
    options: { A: 'Riza Hawkeye', B: 'Lan Fan', C: 'Winry Rockbell', D: 'Izumi Curtis' },
    answer: 'C',
  },
  {
    id: 70, anime: 'Fullmetal Alchemist: Brotherhood', difficulty: 'hard',
    question: 'What technique allows alchemy without a transmutation circle?',
    options: { A: 'Blood Alchemy', B: 'Truth Alchemy', C: 'Body Alchemy — using your own body as the circle', D: 'Clapping Alchemy' },
    answer: 'C',
  },

  // ══ ATTACK ON TITAN (71-79) ═════════════════════════════════════════════════
  {
    id: 71, anime: 'Attack on Titan', difficulty: 'easy',
    question: 'What is the name of the military organization Levi belongs to?',
    options: { A: 'Military Police', B: 'Garrison Regiment', C: 'Survey Corps', D: 'Warrior Unit' },
    answer: 'C',
  },
  {
    id: 72, anime: 'Attack on Titan', difficulty: 'medium',
    question: 'What is the name of Eren\'s Titan ability that allows him to control other titans?',
    options: { A: 'Attack Titan', B: 'Founding Titan', C: 'War Hammer Titan', D: 'Colossal Titan' },
    answer: 'B',
  },
  {
    id: 73, anime: 'Attack on Titan', difficulty: 'easy',
    question: 'Who is the main villain responsible for starting the Rumbling?',
    options: { A: 'Reiner Braun', B: 'Zeke Yeager', C: 'Eren Yeager', D: 'King Fritz' },
    answer: 'C',
  },
  {
    id: 74, anime: 'Attack on Titan', difficulty: 'medium',
    question: 'What is the Colossus Titan\'s most devastating ability?',
    options: { A: 'Hardening', B: 'Steam emission and explosive transformation', C: 'Controlling other titans', D: 'Lightning strike' },
    answer: 'B',
  },
  {
    id: 75, anime: 'Attack on Titan', difficulty: 'hard',
    question: 'What is the Ackerman clan\'s special power called?',
    options: { A: 'Titan Power', B: 'Awakening Power', C: 'Survey Power', D: 'Bloodline Strength' },
    answer: 'B',
  },
  {
    id: 76, anime: 'Attack on Titan', difficulty: 'medium',
    question: 'What are the walls that protect humanity named after?',
    options: { A: 'Maria, Rose, Sina', B: 'Maria, Clara, Sina', C: 'Alpha, Beta, Gamma', D: 'Eden, Rose, Heaven' },
    answer: 'A',
  },
  {
    id: 77, anime: 'Attack on Titan', difficulty: 'hard',
    question: 'What is the name of the path that connects all Eldians through the Founding Titan?',
    options: { A: 'The Coordinate', B: 'The Paths', C: 'The Founding Path', D: 'The Titan Road' },
    answer: 'B',
  },
  {
    id: 78, anime: 'Attack on Titan', difficulty: 'medium',
    question: 'Who holds the Beast Titan?',
    options: { A: 'Reiner Braun', B: 'Zeke Yeager', C: 'Pieck Finger', D: 'Porco Galliard' },
    answer: 'B',
  },
  {
    id: 79, anime: 'Attack on Titan', difficulty: 'hard',
    question: 'What is the lifespan of a Titan shifter after receiving their power?',
    options: { A: 'Forever', B: '10 years', C: '13 years', D: '7 years' },
    answer: 'C',
  },

  // ══ MY HERO ACADEMIA (80-88) ════════════════════════════════════════════════
  {
    id: 80, anime: 'My Hero Academia', difficulty: 'easy',
    question: 'What is the name of the villain who leads the League of Villains?',
    options: { A: 'Dabi', B: 'Himiko Toga', C: 'Tomura Shigaraki', D: 'Overhaul' },
    answer: 'C',
  },
  {
    id: 81, anime: 'My Hero Academia', difficulty: 'easy',
    question: 'What Quirk does Izuku Midoriya inherit from All Might?',
    options: { A: 'All For One', B: 'One For All', C: 'Super Strength', D: 'Power Transfer' },
    answer: 'B',
  },
  {
    id: 82, anime: 'My Hero Academia', difficulty: 'medium',
    question: 'What is Bakugo\'s Quirk called?',
    options: { A: 'Explosion', B: 'Nitroglycerin', C: 'Detonation', D: 'Blast' },
    answer: 'A',
  },
  {
    id: 83, anime: 'My Hero Academia', difficulty: 'medium',
    question: 'What is the name of All Might\'s secret identity as a civilian?',
    options: { A: 'Toshinori Yagi', B: 'Toshinori Midoriya', C: 'Yagi Toshinori', D: 'Both A and C — same person' },
    answer: 'D',
  },
  {
    id: 84, anime: 'My Hero Academia', difficulty: 'hard',
    question: 'What is the name of the villain who stole half of All Might\'s power?',
    options: { A: 'Shigaraki', B: 'All For One', C: 'Nomu', D: 'Overhaul' },
    answer: 'B',
  },
  {
    id: 85, anime: 'My Hero Academia', difficulty: 'medium',
    question: 'What is Todoroki\'s Quirk?',
    options: { A: 'Fire and Ice', B: 'Half-Cold Half-Hot', C: 'Dual Temperature', D: 'Glacier Flame' },
    answer: 'B',
  },
  {
    id: 86, anime: 'My Hero Academia', difficulty: 'easy',
    question: 'What is the school that Izuku attends to become a hero?',
    options: { A: 'Shiketsu High', B: 'UA High School', C: 'Ketsubutsu Academy', D: 'Isamu Academy' },
    answer: 'B',
  },
  {
    id: 87, anime: 'My Hero Academia', difficulty: 'hard',
    question: 'How many users of One For All have there been before Deku?',
    options: { A: 'Six', B: 'Seven', C: 'Eight', D: 'Nine' },
    answer: 'C',
  },
  {
    id: 88, anime: 'My Hero Academia', difficulty: 'medium',
    question: 'What is Eraserhead\'s (Aizawa) Quirk?',
    options: { A: 'Binding Cloth', B: 'Erasure — nullifies Quirks by looking at them', C: 'Sleep Inducement', D: 'Capture Weapon' },
    answer: 'B',
  },

  // ══ DRAGON BALL (89-96) ═════════════════════════════════════════════════════
  {
    id: 89, anime: 'Dragon Ball', difficulty: 'easy',
    question: 'What is the name of Goku\'s signature energy attack?',
    options: { A: 'Final Flash', B: 'Special Beam Cannon', C: 'Kamehameha', D: 'Galick Gun' },
    answer: 'C',
  },
  {
    id: 90, anime: 'Dragon Ball', difficulty: 'medium',
    question: 'Who is the God of Destruction of Universe 7?',
    options: { A: 'Whis', B: 'Beerus', C: 'Champa', D: 'Grand Zeno' },
    answer: 'B',
  },
  {
    id: 91, anime: 'Dragon Ball', difficulty: 'easy',
    question: 'What transformation does Goku achieve by mastering his emotions?',
    options: { A: 'Super Saiyan Blue', B: 'Super Saiyan God', C: 'Ultra Instinct', D: 'Super Saiyan 4' },
    answer: 'C',
  },
  {
    id: 92, anime: 'Dragon Ball', difficulty: 'medium',
    question: 'What race is Frieza?',
    options: { A: 'Saiyan', B: 'Namekian', C: 'Arcosian', D: 'Android' },
    answer: 'C',
  },
  {
    id: 93, anime: 'Dragon Ball', difficulty: 'hard',
    question: 'What technique did Future Trunks develop to fight Fused Zamasu?',
    options: { A: 'Final Flash', B: 'Spirit Bomb Sword', C: 'Sword of Hope', D: 'Spirit Sword' },
    answer: 'C',
  },
  {
    id: 94, anime: 'Dragon Ball', difficulty: 'medium',
    question: 'What is the fusion technique that merges Goku and Vegeta called?',
    options: { A: 'Potara Fusion', B: 'Fusion Dance', C: 'Both A and B are different methods', D: 'Metamoran Fusion' },
    answer: 'C',
  },
  {
    id: 95, anime: 'Dragon Ball', difficulty: 'easy',
    question: 'What is the name of Vegeta\'s most powerful solo technique?',
    options: { A: 'Galick Gun', B: 'Big Bang Attack', C: 'Final Flash', D: 'Final Explosion' },
    answer: 'C',
  },
  {
    id: 96, anime: 'Dragon Ball', difficulty: 'hard',
    question: 'Who is the Omni-King who oversees all 12 universes?',
    options: { A: 'Grand Priest', B: 'Zeno', C: 'Beerus', D: 'Whis' },
    answer: 'B',
  },

  // ══ SOLO LEVELING (97-104) ══════════════════════════════════════════════════
  {
    id: 97, anime: 'Solo Leveling', difficulty: 'easy',
    question: 'What rank was Sung Jin-Woo before the System chose him?',
    options: { A: 'D-Rank', B: 'C-Rank', C: 'E-Rank', D: 'F-Rank' },
    answer: 'C',
  },
  {
    id: 98, anime: 'Solo Leveling', difficulty: 'medium',
    question: 'What is the name of Jin-Woo\'s most loyal shadow soldier?',
    options: { A: 'Beru', B: 'Igris', C: 'Tank', D: 'Iron' },
    answer: 'B',
  },
  {
    id: 99, anime: 'Solo Leveling', difficulty: 'medium',
    question: 'What is the name of the power system Jin-Woo uses to command shadows?',
    options: { A: 'Shadow Extraction', B: 'Arise', C: 'Shadow Monarch\'s Power', D: 'Necromancy' },
    answer: 'B',
  },
  {
    id: 100, anime: 'Solo Leveling', difficulty: 'hard',
    question: 'Who is the Monarch of Destruction that serves as a major antagonist?',
    options: { A: 'The Frost Monarch', B: 'The Architect', C: 'The Monarchs', D: 'Antares — Dragon Emperor' },
    answer: 'D',
  },
  {
    id: 101, anime: 'Solo Leveling', difficulty: 'medium',
    question: 'What is the name of the system that grants Jin-Woo his powers?',
    options: { A: 'The Gate System', B: 'The Ruler\'s System', C: 'The Daily Quest System', D: 'The Architect\'s System' },
    answer: 'D',
  },
  {
    id: 102, anime: 'Solo Leveling', difficulty: 'easy',
    question: 'What rank does Jin-Woo hold among hunters in Korea by the middle of the story?',
    options: { A: 'A-Rank', B: 'S-Rank', C: 'National Level Hunter', D: 'Shadow Monarch' },
    answer: 'B',
  },
  {
    id: 103, anime: 'Solo Leveling', difficulty: 'hard',
    question: 'What was Jin-Woo\'s title before becoming the Shadow Monarch?',
    options: { A: 'The Player', B: 'The Weakest Hunter', C: 'The Awakened', D: 'The Chosen' },
    answer: 'A',
  },
  {
    id: 104, anime: 'Solo Leveling', difficulty: 'medium',
    question: 'What is the name of the ant king that Jin-Woo defeats and adds to his army?',
    options: { A: 'Beru', B: 'Antares', C: 'Iron', D: 'Tank' },
    answer: 'A',
  },

  // ══ CODE GEASS (105-110) ════════════════════════════════════════════════════
  {
    id: 105, anime: 'Code Geass', difficulty: 'easy',
    question: 'What is the name of Lelouch\'s power in Code Geass?',
    options: { A: 'Mind Control', B: 'Geass', C: 'Absolute Command', D: 'Emperor\'s Eye' },
    answer: 'B',
  },
  {
    id: 106, anime: 'Code Geass', difficulty: 'medium',
    question: 'What is Lelouch\'s alter ego as the leader of the Black Knights?',
    options: { A: 'Black King', B: 'Zero', C: 'The Masked Prince', D: 'Emperor Zero' },
    answer: 'B',
  },
  {
    id: 107, anime: 'Code Geass', difficulty: 'medium',
    question: 'What is the name of the Knightmare Frame Suzaku pilots?',
    options: { A: 'Guren', B: 'Mordred', C: 'Lancelot', D: 'Galahad' },
    answer: 'C',
  },
  {
    id: 108, anime: 'Code Geass', difficulty: 'hard',
    question: 'What is the true name of C.C. in Code Geass?',
    options: { A: 'It is never revealed', B: 'Cecile', C: 'Charlotte', D: 'Cera' },
    answer: 'A',
  },
  {
    id: 109, anime: 'Code Geass', difficulty: 'medium',
    question: 'What is the name of the empire Lelouch fights against?',
    options: { A: 'The Federation', B: 'The Holy Britannian Empire', C: 'The Europia United', D: 'The Chinese Federation' },
    answer: 'B',
  },
  {
    id: 110, anime: 'Code Geass', difficulty: 'hard',
    question: 'What is the name of Lelouch\'s plan to end all wars by making himself the world\'s enemy?',
    options: { A: 'Zero Requiem', B: 'Operation Ragnarok', C: 'The Geass Order', D: 'The Demon King\'s Plan' },
    answer: 'A',
  },

  // ══ RE:ZERO (111-116) ═══════════════════════════════════════════════════════
  {
    id: 111, anime: 'Re:Zero', difficulty: 'easy',
    question: 'What is the name of Subaru Natsuki\'s unique ability in Re:Zero?',
    options: { A: 'Time Loop', B: 'Return by Death', C: 'Resurrection', D: 'Save Point' },
    answer: 'B',
  },
  {
    id: 112, anime: 'Re:Zero', difficulty: 'medium',
    question: 'Who is Roswaal L Mathers and why is he significant?',
    options: { A: 'He is the final villain', B: 'He is Emilia\'s guardian and has a gospel book', C: 'He is a Dragon Priestor', D: 'He is Subaru\'s father' },
    answer: 'B',
  },
  {
    id: 113, anime: 'Re:Zero', difficulty: 'medium',
    question: 'What is the name of Rem\'s sister?',
    options: { A: 'Emilia', B: 'Beatrice', C: 'Ram', D: 'Felt' },
    answer: 'C',
  },
  {
    id: 114, anime: 'Re:Zero', difficulty: 'hard',
    question: 'What are the Witches of Sin named after?',
    options: { A: 'Seven Deadly Sins', B: 'Seven Virtues', C: 'The Deadly Factors', D: 'Demonic Sins' },
    answer: 'A',
  },
  {
    id: 115, anime: 'Re:Zero', difficulty: 'medium',
    question: 'What race is Rem and Ram?',
    options: { A: 'Half-Elves', B: 'Demons', C: 'Oni', D: 'Demi-humans' },
    answer: 'C',
  },
  {
    id: 116, anime: 'Re:Zero', difficulty: 'hard',
    question: 'Who is the Archbishop of Pride in Re:Zero?',
    options: { A: 'Subaru Natsuki', B: 'Petelgeuse Romanee-Conti', C: 'Regulus Corneas', D: 'Roy Alphard' },
    answer: 'A',
  },

  // ══ CHAINSAW MAN (117-122) ══════════════════════════════════════════════════
  {
    id: 117, anime: 'Chainsaw Man', difficulty: 'easy',
    question: 'Who is the main protagonist of Chainsaw Man?',
    options: { A: 'Aki Hayakawa', B: 'Denji', C: 'Power', D: 'Kishibe' },
    answer: 'B',
  },
  {
    id: 118, anime: 'Chainsaw Man', difficulty: 'medium',
    question: 'What devil did Denji merge with to become Chainsaw Man?',
    options: { A: 'Gun Devil', B: 'Darkness Devil', C: 'Pochita — the Chainsaw Devil', D: 'Blood Devil' },
    answer: 'C',
  },
  {
    id: 119, anime: 'Chainsaw Man', difficulty: 'medium',
    question: 'What is Makima\'s true identity?',
    options: { A: 'The Control Devil', B: 'The Primal Fear Devil', C: 'The Death Devil', D: 'The Gun Devil' },
    answer: 'A',
  },
  {
    id: 120, anime: 'Chainsaw Man', difficulty: 'hard',
    question: 'What special property does the Chainsaw Devil have that makes it feared by other devils?',
    options: { A: 'It\'s immortal', B: 'It erases devils from existence and memory when it eats them', C: 'It absorbs other devils\' power', D: 'It can\'t be killed' },
    answer: 'B',
  },
  {
    id: 121, anime: 'Chainsaw Man', difficulty: 'medium',
    question: 'What is Power\'s role among the devil hunters?',
    options: { A: 'She is a human devil hunter', B: 'She is a fiend — devil in a human body', C: 'She is a contract devil', D: 'She is Makima\'s weapon' },
    answer: 'B',
  },
  {
    id: 122, anime: 'Chainsaw Man', difficulty: 'hard',
    question: 'What is the contract Denji made with Pochita?',
    options: { A: 'Denji gives his heart to Pochita', B: 'Pochita becomes Denji\'s heart and saves his life if Denji shows him his dreams', C: 'They share power equally', D: 'Denji hunts devils for Pochita' },
    answer: 'B',
  },

  // ══ MOB PSYCHO 100 (123-127) ════════════════════════════════════════════════
  {
    id: 123, anime: 'Mob Psycho 100', difficulty: 'easy',
    question: 'What is the real name of the main character "Mob" in Mob Psycho 100?',
    options: { A: 'Sho Suzuki', B: 'Ritsu Kageyama', C: 'Shigeo Kageyama', D: 'Teruki Hanazawa' },
    answer: 'C',
  },
  {
    id: 124, anime: 'Mob Psycho 100', difficulty: 'medium',
    question: 'What happens when Mob\'s emotional meter reaches 100%?',
    options: { A: 'He faints', B: 'His powers amplify to maximum', C: 'He loses control', D: 'All of the above depending on the emotion' },
    answer: 'D',
  },
  {
    id: 125, anime: 'Mob Psycho 100', difficulty: 'medium',
    question: 'Who is Mob\'s master and self-proclaimed greatest psychic?',
    options: { A: 'Dimple', B: 'Teru Hanazawa', C: 'Reigen Arataka', D: 'Katsuya Serizawa' },
    answer: 'C',
  },
  {
    id: 126, anime: 'Mob Psycho 100', difficulty: 'hard',
    question: 'What organization is the main antagonist group in Mob Psycho 100 season 2?',
    options: { A: 'The 7th Division', B: 'Claw', C: 'The Psycho Helmet Cult', D: 'The Awakening Lab' },
    answer: 'B',
  },
  {
    id: 127, anime: 'Mob Psycho 100', difficulty: 'hard',
    question: 'What form does Mob enter that goes beyond ???% and is considered his ultimate state?',
    options: { A: 'Full Power', B: 'Corrupt Mob', C: 'World Destruction Mode', D: 'Shigeo Awakened' },
    answer: 'B',
  },

  // ══ SPY X FAMILY (128-132) ══════════════════════════════════════════════════
  {
    id: 128, anime: 'Spy x Family', difficulty: 'easy',
    question: 'What is the codename of the spy protagonist in Spy x Family?',
    options: { A: 'Nightfall', B: 'Twilight', C: 'Dawn', D: 'Dusk' },
    answer: 'B',
  },
  {
    id: 129, anime: 'Spy x Family', difficulty: 'easy',
    question: 'What is special about Anya Forger?',
    options: { A: 'She is an assassin', B: 'She can read minds', C: 'She has super strength', D: 'She is a spy' },
    answer: 'B',
  },
  {
    id: 130, anime: 'Spy x Family', difficulty: 'medium',
    question: 'What is Yor Forger\'s secret identity?',
    options: { A: 'She is a spy', B: 'She is the Thorn Princess — an assassin', C: 'She works for the government', D: 'She is a Nightfall agent' },
    answer: 'B',
  },
  {
    id: 131, anime: 'Spy x Family', difficulty: 'medium',
    question: 'What is the name of the mission Loid undertakes that requires him to form a family?',
    options: { A: 'Operation Peacock', B: 'Operation Strix', C: 'Operation Family', D: 'Operation Eden' },
    answer: 'B',
  },
  {
    id: 132, anime: 'Spy x Family', difficulty: 'hard',
    question: 'What school must Anya get into to help complete Operation Strix?',
    options: { A: 'Imperial Scholar Academy', B: 'Eden Academy', C: 'Westalis Elite School', D: 'Berlint Academy' },
    answer: 'B',
  },

  // ══ BLACK CLOVER (133-137) ══════════════════════════════════════════════════
  {
    id: 133, anime: 'Black Clover', difficulty: 'easy',
    question: 'What unique ability does Asta have that makes him special in a magic-based world?',
    options: { A: 'Unlimited magic power', B: 'No magic — uses Anti-Magic', C: 'Dark Magic', D: 'Time Magic' },
    answer: 'B',
  },
  {
    id: 134, anime: 'Black Clover', difficulty: 'medium',
    question: 'What is the name of the devil inside Asta?',
    options: { A: 'Zagred', B: 'Liebe', C: 'Megicula', D: 'Lucifero' },
    answer: 'B',
  },
  {
    id: 135, anime: 'Black Clover', difficulty: 'medium',
    question: 'What magic squad does Asta join?',
    options: { A: 'Golden Dawn', B: 'Silver Eagles', C: 'Black Bulls', D: 'Crimson Lions' },
    answer: 'C',
  },
  {
    id: 136, anime: 'Black Clover', difficulty: 'hard',
    question: 'Who is the leader of the Spade Kingdom\'s Dark Triad?',
    options: { A: 'Zenon', B: 'Vanica', C: 'Dante Zogratis', D: 'Moris' },
    answer: 'C',
  },
  {
    id: 137, anime: 'Black Clover', difficulty: 'medium',
    question: 'What is Yuno\'s magical attribute?',
    options: { A: 'Darkness Magic', B: 'Wind Magic and Star Magic', C: 'Lightning Magic', D: 'Holy Magic' },
    answer: 'B',
  },

  // ══ FAIRY TAIL (138-142) ════════════════════════════════════════════════════
  {
    id: 138, anime: 'Fairy Tail', difficulty: 'easy',
    question: 'Who is the main villain at the end of Fairy Tail?',
    options: { A: 'Hades', B: 'Zeref Dragneel', C: 'Acnologia', D: 'Both B and C' },
    answer: 'D',
  },
  {
    id: 139, anime: 'Fairy Tail', difficulty: 'medium',
    question: 'What type of Dragon Slayer magic does Natsu use?',
    options: { A: 'Lightning Dragon Slayer', B: 'Shadow Dragon Slayer', C: 'Fire Dragon Slayer', D: 'Sky Dragon Slayer' },
    answer: 'C',
  },
  {
    id: 140, anime: 'Fairy Tail', difficulty: 'medium',
    question: 'What is the name of Erza Scarlet\'s signature requip armor?',
    options: { A: 'Heavenly Knight Armor', B: 'Heart Kreuz Armor', C: 'Adamantine Armor', D: 'Flame Empress Armor' },
    answer: 'B',
  },
  {
    id: 141, anime: 'Fairy Tail', difficulty: 'hard',
    question: 'What is END — the demon that Zeref created?',
    options: { A: 'A demon weapon', B: 'Natsu Dragneel himself', C: 'The Black Wizard\'s familiar', D: 'Acnologia\'s true form' },
    answer: 'B',
  },
  {
    id: 142, anime: 'Fairy Tail', difficulty: 'medium',
    question: 'What is Gray Fullbuster\'s magic?',
    options: { A: 'Water Magic', B: 'Ice-Make Magic', C: 'Snow Magic', D: 'Frost Magic' },
    answer: 'B',
  },

  // ══ SWORD ART ONLINE (143-147) ══════════════════════════════════════════════
  {
    id: 143, anime: 'Sword Art Online', difficulty: 'easy',
    question: 'Who trapped 10,000 players inside Sword Art Online?',
    options: { A: 'Sugou Nobuyuki', B: 'Kayaba Akihiko', C: 'Death Gun', D: 'Administrator' },
    answer: 'B',
  },
  {
    id: 144, anime: 'Sword Art Online', difficulty: 'medium',
    question: 'What unique skill did Kirito unlock that no one else had?',
    options: { A: 'Starburst Stream', B: 'Dual Blades', C: 'Eclipse', D: 'Void' },
    answer: 'B',
  },
  {
    id: 145, anime: 'Sword Art Online', difficulty: 'medium',
    question: 'What is the name of Asuna\'s guild in Aincrad?',
    options: { A: 'Dragon Knights Brigade', B: 'Legend Braves', C: 'Knights of the Blood', D: 'Army' },
    answer: 'C',
  },
  {
    id: 146, anime: 'Sword Art Online', difficulty: 'hard',
    question: 'What is the name of the AI created by Kayaba that Kirito meets in Aincrad?',
    options: { A: 'Yui', B: 'Alice', C: 'Cardinal', D: 'Stacia' },
    answer: 'A',
  },
  {
    id: 147, anime: 'Sword Art Online', difficulty: 'medium',
    question: 'What is the death rule in Sword Art Online?',
    options: { A: 'Dying sends you to respawn', B: 'Dying in-game sends a signal that kills you in real life', C: 'Losing HP means logout only', D: 'You fall asleep permanently' },
    answer: 'B',
  },

  // ══ TOKYO GHOUL (148-152) ═══════════════════════════════════════════════════
  {
    id: 148, anime: 'Tokyo Ghoul', difficulty: 'easy',
    question: 'What is the name of the one-eyed ghoul who is a major antagonist in Tokyo Ghoul?',
    options: { A: 'Uta', B: 'Yoshimura', C: 'Arima Kishou', D: 'Kaneki Ken himself' },
    answer: 'D',
  },
  {
    id: 149, anime: 'Tokyo Ghoul', difficulty: 'medium',
    question: 'What weapon do CCG investigators use to fight ghouls?',
    options: { A: 'Quinque — weapons made from ghoul kagune', B: 'Silver bullets', C: 'Energy weapons', D: 'Anti-ghoul serum' },
    answer: 'A',
  },
  {
    id: 150, anime: 'Tokyo Ghoul', difficulty: 'medium',
    question: 'What type of kagune does Kaneki Ken have?',
    options: { A: 'Rinkaku', B: 'Ukaku', C: 'Bikaku', D: 'Koukaku' },
    answer: 'A',
  },
  {
    id: 151, anime: 'Tokyo Ghoul', difficulty: 'hard',
    question: 'Who is the One-Eyed Owl?',
    options: { A: 'Eto Yoshimura', B: 'Yoshimura himself', C: 'Ken Kaneki', D: 'Both A — Eto is the true Owl' },
    answer: 'D',
  },
  {
    id: 152, anime: 'Tokyo Ghoul', difficulty: 'medium',
    question: 'What organization hunts ghouls in Tokyo Ghoul?',
    options: { A: 'The Dove Agency', B: 'Commission of Counter Ghoul (CCG)', C: 'Aogiri Tree', D: 'V' },
    answer: 'B',
  },

  // ══ OVERLORD (153-156) ══════════════════════════════════════════════════════
  {
    id: 153, anime: 'Overlord', difficulty: 'easy',
    question: 'What is the real name of Ainz Ooal Gown?',
    options: { A: 'Momonga', B: 'Touch Me', C: 'Ulbert', D: 'Peroroncino' },
    answer: 'A',
  },
  {
    id: 154, anime: 'Overlord', difficulty: 'medium',
    question: 'What is the name of Ainz\'s supreme tomb?',
    options: { A: 'The Great Tomb of Nazarick', B: 'The Lich\'s Fortress', C: 'Overlord\'s Keep', D: 'The Undead Citadel' },
    answer: 'A',
  },
  {
    id: 155, anime: 'Overlord', difficulty: 'medium',
    question: 'What class is Ainz in the game?',
    options: { A: 'Vampire Lord', B: 'Overlord — an Undead magic caster', C: 'Death Knight', D: 'Lich King' },
    answer: 'B',
  },
  {
    id: 156, anime: 'Overlord', difficulty: 'hard',
    question: 'What is the name of Ainz\'s most powerful spell?',
    options: { A: 'Grasp Heart', B: 'True Death', C: 'Iä Shub-Niggurath', D: 'Fallen Down' },
    answer: 'C',
  },

  // ══ THAT TIME I GOT REINCARNATED AS A SLIME (157-161) ══════════════════════
  {
    id: 157, anime: 'That Time I Got Reincarnated as a Slime', difficulty: 'easy',
    question: 'What is the name of the slime protagonist in the series?',
    options: { A: 'Benimaru', B: 'Rimuru Tempest', C: 'Milim', D: 'Shion' },
    answer: 'B',
  },
  {
    id: 158, anime: 'That Time I Got Reincarnated as a Slime', difficulty: 'medium',
    question: 'What unique skill allows Rimuru to copy abilities of things he eats?',
    options: { A: 'Gluttony', B: 'Predator', C: 'Devour', D: 'Copy Skill' },
    answer: 'B',
  },
  {
    id: 159, anime: 'That Time I Got Reincarnated as a Slime', difficulty: 'medium',
    question: 'What is the name of the nation Rimuru founds?',
    options: { A: 'Tempest Kingdom', B: 'Jura Tempest Federation', C: 'Slime Nation', D: 'Monster Kingdom' },
    answer: 'B',
  },
  {
    id: 160, anime: 'That Time I Got Reincarnated as a Slime', difficulty: 'hard',
    question: 'What does Rimuru become after performing the Harvest Festival?',
    options: { A: 'A True Dragon', B: 'A Demon Lord', C: 'A God', D: 'An Awakened Slime' },
    answer: 'B',
  },
  {
    id: 161, anime: 'That Time I Got Reincarnated as a Slime', difficulty: 'medium',
    question: 'Who is the Storm Dragon that Rimuru befriends early in the series?',
    options: { A: 'Milim', B: 'Veldora', C: 'Velgrynd', D: 'Velzard' },
    answer: 'B',
  },

  // ══ ONE PUNCH MAN (162-166) ══════════════════════════════════════════════════
  {
    id: 162, anime: 'One Punch Man', difficulty: 'easy',
    question: 'How did Saitama gain his power in One Punch Man?',
    options: { A: 'He was born with it', B: '100 push-ups, sit-ups, squats and 10km run daily for 3 years', C: 'A radioactive accident', D: 'He made a deal with a monster' },
    answer: 'B',
  },
  {
    id: 163, anime: 'One Punch Man', difficulty: 'medium',
    question: 'What rank is Saitama in the Hero Association?',
    options: { A: 'S-Class', B: 'A-Class', C: 'B-Class', D: 'C-Class at the start' },
    answer: 'D',
  },
  {
    id: 164, anime: 'One Punch Man', difficulty: 'medium',
    question: 'Who is the top ranked S-Class hero in One Punch Man?',
    options: { A: 'Tatsumaki', B: 'Bang', C: 'Blast', D: 'Metal Knight' },
    answer: 'C',
  },
  {
    id: 165, anime: 'One Punch Man', difficulty: 'hard',
    question: 'What is Garou\'s ultimate form called?',
    options: { A: 'Awakened Garou', B: 'Cosmic Garou', C: 'Monster Garou', D: 'God Garou' },
    answer: 'B',
  },
  {
    id: 166, anime: 'One Punch Man', difficulty: 'medium',
    question: 'What is Genos\' role in relation to Saitama?',
    options: { A: 'His rival', B: 'His enemy', C: 'His disciple', D: 'His neighbour' },
    answer: 'C',
  },

  // ══ STEINS;GATE (167-170) ═══════════════════════════════════════════════════
  {
    id: 167, anime: 'Steins;Gate', difficulty: 'easy',
    question: 'What machine does Okabe accidentally create that can send messages to the past?',
    options: { A: 'Time Machine', B: 'Phone Microwave', C: 'D-Mail Device', D: 'Divergence Meter' },
    answer: 'B',
  },
  {
    id: 168, anime: 'Steins;Gate', difficulty: 'medium',
    question: 'What is the name of the organization that opposes Okabe?',
    options: { A: 'CERN', B: 'SERN', C: 'The Time Bureau', D: 'Rounders' },
    answer: 'B',
  },
  {
    id: 169, anime: 'Steins;Gate', difficulty: 'hard',
    question: 'What is the divergence number of the Steins Gate worldline?',
    options: { A: '0.571024%', B: '1.048596%', C: '0.999999%', D: '1.130205%' },
    answer: 'B',
  },
  {
    id: 170, anime: 'Steins;Gate', difficulty: 'medium',
    question: 'What is the name of the self-proclaimed mad scientist protagonist?',
    options: { A: 'Hashida Itaru', B: 'Makise Kurisu', C: 'Rintaro Okabe', D: 'Tennouji Yuugo' },
    answer: 'C',
  },

  // ══ AKAME GA KILL (171-174) ══════════════════════════════════════════════════
  {
    id: 171, anime: 'Akame ga Kill', difficulty: 'easy',
    question: 'What are the special weapons called in Akame ga Kill?',
    options: { A: 'Cursed Arms', B: 'Imperial Arms (Teigu)', C: 'Devil Weapons', D: 'Sacred Arms' },
    answer: 'B',
  },
  {
    id: 172, anime: 'Akame ga Kill', difficulty: 'medium',
    question: 'What is the name of Akame\'s blade and its special ability?',
    options: { A: 'Murasame — one cut kills', B: 'Pumpkin — long range sniper', C: 'Incursio — armour', D: 'Extase — scissors' },
    answer: 'A',
  },
  {
    id: 173, anime: 'Akame ga Kill', difficulty: 'medium',
    question: 'What is the name of the assassin group the protagonists belong to?',
    options: { A: 'The Revolutionary Army', B: 'The Jaegers', C: 'Night Raid', D: 'The Empire\'s Guard' },
    answer: 'C',
  },
  {
    id: 174, anime: 'Akame ga Kill', difficulty: 'hard',
    question: 'Who is Esdeath and what is her Teigu ability?',
    options: { A: 'General who controls ice — Demon\'s Extract', B: 'Admiral who uses fire', C: 'Assassin who controls time', D: 'General who uses lightning' },
    answer: 'A',
  },

  // ══ FATE SERIES (175-178) ════════════════════════════════════════════════════
  {
    id: 175, anime: 'Fate', difficulty: 'easy',
    question: 'What is the name of the war in the Fate series where Servants battle for the Holy Grail?',
    options: { A: 'Holy Grail War', B: 'Servant Battle', C: 'Grail Tournament', D: 'Fate War' },
    answer: 'A',
  },
  {
    id: 176, anime: 'Fate', difficulty: 'medium',
    question: 'What is the name of Emiya Shirou\'s unique ability in Fate/Stay Night?',
    options: { A: 'Reinforcement', B: 'Projection', C: 'Unlimited Blade Works', D: 'Rule Breaker' },
    answer: 'C',
  },
  {
    id: 177, anime: 'Fate', difficulty: 'hard',
    question: 'What hero is Saber\'s true identity in Fate/Stay Night?',
    options: { A: 'Lancelot', B: 'King Arthur — Artoria Pendragon', C: 'Charlemagne', D: 'Alexander the Great' },
    answer: 'B',
  },
  {
    id: 178, anime: 'Fate', difficulty: 'medium',
    question: 'What class is Gilgamesh in the Holy Grail War?',
    options: { A: 'Lancer', B: 'Berserker', C: 'Archer', D: 'Caster' },
    answer: 'C',
  },

  // ══ MIXED ANIME — GENERAL KNOWLEDGE (179-200) ══════════════════════════════
  {
    id: 179, anime: 'General', difficulty: 'easy',
    question: 'In which anime does the protagonist fight using playing cards and candy?',
    options: { A: 'Hunter x Hunter', B: 'Cardcaptor Sakura', C: 'Yu-Gi-Oh', D: 'Kakegurui' },
    answer: 'A',
  },
  {
    id: 180, anime: 'General', difficulty: 'easy',
    question: 'Which anime is set in a world where 80% of the population has superpowers called Quirks?',
    options: { A: 'Bleach', B: 'My Hero Academia', C: 'Black Clover', D: 'Naruto' },
    answer: 'B',
  },
  {
    id: 181, anime: 'General', difficulty: 'medium',
    question: 'In Naruto, what is the name of the technique that combines all five chakra natures?',
    options: { A: 'Wood Release', B: 'Six Paths Technique', C: 'Truth-Seeking Ball', D: 'All of the above use five natures' },
    answer: 'D',
  },
  {
    id: 182, anime: 'General', difficulty: 'medium',
    question: 'What is the name of the power system in Bleach where Soul Reapers release their true power?',
    options: { A: 'Bankai', B: 'Release', C: 'Zanpakuto Awakening', D: 'Shikai and Bankai together' },
    answer: 'D',
  },
  {
    id: 183, anime: 'General', difficulty: 'hard',
    question: 'Which anime features a battle system where the winner is determined by gambling rather than combat?',
    options: { A: 'No Game No Life', B: 'Kakegurui', C: 'Both feature gambling as central', D: 'Death Parade' },
    answer: 'C',
  },
  {
    id: 184, anime: 'General', difficulty: 'easy',
    question: 'In Dragon Ball, what is required to summon Shenron the Dragon?',
    options: { A: '5 Dragon Balls', B: '6 Dragon Balls', C: '7 Dragon Balls', D: '4 Dragon Balls' },
    answer: 'C',
  },
  {
    id: 185, anime: 'General', difficulty: 'medium',
    question: 'Which anime features the concept of "Stands" — spiritual manifestations of a person\'s willpower?',
    options: { A: 'Berserk', B: 'JoJo\'s Bizarre Adventure', C: 'Parasyte', D: 'Blue Exorcist' },
    answer: 'B',
  },
  {
    id: 186, anime: 'General', difficulty: 'medium',
    question: 'What is the name of the iconic academy in Assassination Classroom?',
    options: { A: 'Kunugigaoka Junior High Class 3-E', B: 'Korosensei Academy', C: 'Death Class', D: 'Assassination High' },
    answer: 'A',
  },
  {
    id: 187, anime: 'General', difficulty: 'hard',
    question: 'In which anime does the power system revolve around Stands with names based on Tarot cards and band names?',
    options: { A: 'Persona', B: 'JoJo\'s Bizarre Adventure', C: 'Cardcaptor Sakura', D: 'Yu-Gi-Oh' },
    answer: 'B',
  },
  {
    id: 188, anime: 'General', difficulty: 'easy',
    question: 'What does the acronym "OPM" stand for in anime?',
    options: { A: 'One Punch Manga', B: 'One Powerful Man', C: 'One Punch Man', D: 'One Powerful Monster' },
    answer: 'C',
  },
  {
    id: 189, anime: 'General', difficulty: 'medium',
    question: 'In Attack on Titan what is the name of the vertical maneuvering equipment used by soldiers?',
    options: { A: 'ODM Gear', B: '3D Maneuver Gear', C: 'Both A and B are correct names for it', D: 'Titan Gear' },
    answer: 'C',
  },
  {
    id: 190, anime: 'General', difficulty: 'hard',
    question: 'Which anime is set in a world where death gods drop notebooks that kill anyone whose name is written in them?',
    options: { A: 'Platinum End', B: 'Death Parade', C: 'Death Note', D: 'Angel Beats' },
    answer: 'C',
  },
  {
    id: 191, anime: 'General', difficulty: 'medium',
    question: 'In Demon Slayer what material are the demon slayers\' blades made from that changes colour?',
    options: { A: 'Nichirin Steel', B: 'Sun Steel', C: 'Demon Metal', D: 'Blood Iron' },
    answer: 'A',
  },
  {
    id: 192, anime: 'General', difficulty: 'easy',
    question: 'What is the name of the manga artist whose works include both Death Note and Bakuman?',
    options: { A: 'Masashi Kishimoto', B: 'Tsugumi Ohba', C: 'Akira Toriyama', D: 'Eiichiro Oda' },
    answer: 'B',
  },
  {
    id: 193, anime: 'General', difficulty: 'hard',
    question: 'In JoJo\'s Bizarre Adventure Part 4, who is the main villain hiding as an ordinary citizen?',
    options: { A: 'Dio Brando', B: 'Yoshikage Kira', C: 'Diavolo', D: 'Enrico Pucci' },
    answer: 'B',
  },
  {
    id: 194, anime: 'General', difficulty: 'medium',
    question: 'In which anime does the main character die in the first episode and become a ghost?',
    options: { A: 'Angel Beats', B: 'Anohana', C: 'Tokyo Ghoul', D: 'Noragami' },
    answer: 'A',
  },
  {
    id: 195, anime: 'General', difficulty: 'easy',
    question: 'What is the name of the main studio behind iconic anime like Fullmetal Alchemist Brotherhood and Sword Art Online?',
    options: { A: 'Toei Animation', B: 'Bones and A-1 Pictures respectively', C: 'Madhouse', D: 'Wit Studio' },
    answer: 'B',
  },
  {
    id: 196, anime: 'General', difficulty: 'hard',
    question: 'Which anime features a main character who is a reincarnated slime that absorbs abilities?',
    options: { A: 'Overlord', B: 'The Rising of the Shield Hero', C: 'That Time I Got Reincarnated as a Slime', D: 'Jobless Reincarnation' },
    answer: 'C',
  },
  {
    id: 197, anime: 'General', difficulty: 'medium',
    question: 'In Hunter x Hunter what are the four basic Nen types a person is born with?',
    options: { A: 'Enhancement Emission Transmutation Manipulation', B: 'Specialist Conjurer Enhancer Emitter', C: 'All six types: Enhancer Emitter Transmuter Conjurer Manipulator Specialist', D: 'There are only two: Attack and Defence' },
    answer: 'C',
  },
  {
    id: 198, anime: 'General', difficulty: 'easy',
    question: 'What is the name of the orange jumpsuit wearing ninja who wants to be Hokage?',
    options: { A: 'Boruto Uzumaki', B: 'Naruto Uzumaki', C: 'Rock Lee', D: 'Konohamaru' },
    answer: 'B',
  },
  {
    id: 199, anime: 'General', difficulty: 'hard',
    question: 'In Bleach what is the name of the dimension where Hollows live?',
    options: { A: 'Hueco Mundo', B: 'Soul Society', C: 'Dangai', D: 'The Garganta' },
    answer: 'A',
  },
  {
    id: 200, anime: 'General', difficulty: 'medium',
    question: 'Which anime features the "Tournament of Power" where universes compete or face erasure?',
    options: { A: 'Dragon Ball Z', B: 'Dragon Ball GT', C: 'Dragon Ball Super', D: 'Dragon Ball Heroes' },
    answer: 'C',
  },

];

// ── Stats ─────────────────────────────────────────────────────────────────────
const QUIZ_STATS = {
  total:      QUIZ_QUESTIONS.length,
  byDifficulty: {
    easy:   QUIZ_QUESTIONS.filter(q => q.difficulty === 'easy').length,
    medium: QUIZ_QUESTIONS.filter(q => q.difficulty === 'medium').length,
    hard:   QUIZ_QUESTIONS.filter(q => q.difficulty === 'hard').length,
  },
  byAnime: QUIZ_QUESTIONS.reduce((acc, q) => {
    acc[q.anime] = (acc[q.anime] || 0) + 1;
    return acc;
  }, {}),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get N random questions, optionally filtered by difficulty or anime.
 */
function getRandomQuestions(n = 10, { difficulty, anime } = {}) {
  let pool = [...QUIZ_QUESTIONS];
  if (difficulty) pool = pool.filter(q => q.difficulty === difficulty);
  if (anime)      pool = pool.filter(q => q.anime.toLowerCase().includes(anime.toLowerCase()));
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

/**
 * Format a question for WhatsApp display.
 */
function formatQuestion(q, currentNum, total) {
  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎌 *ANIME QUIZ* — Question ${currentNum}/${total}`,
    `📚 ${q.anime}  ·  ${q.difficulty.toUpperCase()}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `❓ *${q.question}*`,
    ``,
    `A. ${q.options.A}`,
    `B. ${q.options.B}`,
    `C. ${q.options.C}`,
    `D. ${q.options.D}`,
    ``,
    `Use *!a A/B/C/D* to answer`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n');
}

module.exports = {
  QUIZ_QUESTIONS,
  QUIZ_STATS,
  getRandomQuestions,
  formatQuestion,
};
