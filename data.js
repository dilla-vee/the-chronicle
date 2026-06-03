// Initial seed data for The Chronicle platform
const INITIAL_ARTICLES = [
  {
    id: "article-1",
    title: "The Renaissance of Physicality in a Hyper-Digital Age",
    subtitle: "Why the modern reader is returning to the tactile sensation of paper, ink, and mechanical objects.",
    category: "Culture",
    author: {
      name: "Julian Thorne",
      role: "Senior Cultural Correspondent",
      avatar: "JT"
    },
    date: "Oct 24, 2024",
    readTime: "12 min read",
    image: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&w=1200&q=80"
    ],
    content: `<p><span class="dropcap">I</span>n an era where our interactions are increasingly mediated through glass screens and haptic vibrations, a silent counter-revolution is taking place. We are witnessing a profound return to the tactile—the weighted pages of a broadsheet, the mechanical click of a Leica shutter, the ritual of drafting with a fountain pen on heavy cream paper. This isn't mere nostalgia; it is a cognitive rebellion against the friction-free ether of the digital space.</p>
    <p>Our brains are fundamentally wired to interact with physical coordinates. When we read a book on a screen, the text flows in a continuous, anchorless scroll. We lose the sensory cues of depth, texture, and position that help construct mental maps. Physical pages give our memories a physical landscape, mapping concepts to the top-right corner of a thick sheet, or the physical depth remaining in the book's right side.</p>
    <p>Furthermore, the friction of physical objects introduces a deliberate slowness. To write with a fountain pen is to accept the drying time of ink; to load a film camera is to commit to twenty-four exposures. This friction invites intentionality, forcing us to pause, contemplate, and select our thoughts before committing them to permanence. In contrast, the ease of digital deletion and modification encourages a rapid, often shallow stream of consciousness.</p>
    <p>As we navigate this hyper-digital landscape, the choice is not binary. We need not reject the efficiency of digital search nor the connectivity of modern networks. Rather, the challenge is to cultivate spaces of physical tactile resistance, where deep reflection can occur away from the relentless pull of notification streams and refreshing feeds.</p>`,
    reviews: [
      {
        id: "rev-1",
        rating: 5,
        title: "Essential Reading",
        text: "This piece articulated exactly what I've been feeling. The connection between physical friction and memory is profound.",
        reviewer: "SARAH L., VERIFIED SUBSCRIBER"
      },
      {
        id: "rev-2",
        rating: 4,
        title: "Thought Provoking",
        text: "A nuanced look at how we engage with information. Thorne's writing style is as deliberate as the subject matter.",
        reviewer: "MARCUS CHEN, JOURNALIST"
      }
    ],
    comments: [
      {
        id: "comm-1",
        authorName: "Elena Rossi",
        role: "Reader",
        avatar: "EL",
        timestamp: "2 hours ago",
        text: "Does this suggest that we should abandon digital tools entirely, or find a hybrid path? The convenience of digital search is hard to replicate in a physical archive.",
        upvotes: 24,
        replies: [
          {
            id: "comm-2",
            authorName: "Julian Thorne",
            role: "Author",
            avatar: "JT",
            isAuthor: true,
            timestamp: "1 hour ago",
            text: "@ElenaRossi Great point. It's about intentionality. Use digital for discovery and search, but physical for synthesis and deep reflection.",
            upvotes: 8,
            replies: []
          }
        ]
      }
    ]
  },
  {
    id: "article-2",
    title: "The Quiet Resurgence of Diplomatic Nuance in a Digital Age",
    subtitle: "As global leaders navigate an increasingly fragmented geopolitical landscape, the traditional art of slow diplomacy is making an unexpected comeback, challenging the immediacy of social media politics.",
    category: "Politics",
    author: {
      name: "Eleanor Jenkins",
      role: "Chief Diplomatic Correspondent",
      avatar: "EJ"
    },
    date: "Jun 02, 2026",
    readTime: "12 min read",
    image: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80"
    ],
    content: `<p><span class="dropcap">T</span>he rapid-fire pacing of online communication has long governed modern statecraft, turning delicate negotiations into soundbites and tweetstorms. Yet behind closed doors, a counter-movement is gaining traction among international diplomats. Realizing that complex global challenges cannot be resolved in character limits, a deliberate return to slow, nuanced diplomacy is quietly occurring.</p>
    <p>This resurgence centers on confidential, unhurried dialogues, away from the scrutiny of the 24-hour news cycle. In these quiet chambers, diplomats are finding the space to build genuine relationships, explore subtle compromises, and acknowledge the shade of grey inherent in international disputes. It is a stark departure from the performative posturing that often dominates public forums.</p>
    <p>Crucially, the success of this slow statecraft relies on patience and trust—two virtues that are easily corroded by immediate digital reactions. By re-establishing boundaries and favoring quiet agreements over instant announcements, modern diplomacy is finding its footing once more in an increasingly volatile world.</p>`,
    reviews: [
      {
        id: "rev-3",
        rating: 5,
        title: "Masterful Analysis",
        text: "Jenkins captures the silent shift in international relations perfectly. Performance politics is failing, and slow diplomacy is the only viable path forward.",
        reviewer: "DAVID W., FOREIGN AFFAIRS ANALYST"
      }
    ],
    comments: [
      {
        id: "comm-3",
        authorName: "Liam Vance",
        role: "Subscriber",
        avatar: "LV",
        timestamp: "5 hours ago",
        text: "A refreshing perspective. Can this private diplomacy be reconciled with democratic demands for transparency, though?",
        upvotes: 15,
        replies: []
      }
    ]
  },
  {
    id: "article-3",
    title: "The Ethics of Generative Architecture",
    subtitle: "When algorithms design our physical spaces, what happens to the human soul of design?",
    category: "Tech",
    author: {
      name: "Marcus Aureli",
      role: "Design & Technology Critic",
      avatar: "MA"
    },
    date: "Jun 02, 2026",
    readTime: "8 min read",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80"
    ],
    content: `<p><span class="dropcap">A</span>s generative AI moves from the screen to the drafting table, architects are confronting a fundamental existential crisis. Algorithms can now generate thousands of optimal building layouts in seconds, weighing wind resistance, sunlight absorption, and material efficiency with perfect mathematical precision. Yet, we must ask: does an optimized space equal a human space?</p>
    <p>Architecture has never been solely about optimization. It is about how light hits a concrete wall at 4:00 PM, the sensory comfort of low ceilings in intimate spaces, and the visual rhythm that invites exploration. These qualitative, emotive factors are difficult to quantify. An algorithm can build a structurally perfect house, but it takes human intuition to turn that house into a home.</p>`,
    reviews: [],
    comments: []
  },
  {
    id: "article-4",
    title: "Reviving the Lost Art of the Personal Essay",
    subtitle: "In a landscape dominated by quick takes and content curation, the long-form personal essay remains a sanctuary for deep, introspective storytelling.",
    category: "Culture",
    author: {
      name: "Clara Vance",
      role: "Literary Columnist",
      avatar: "CV"
    },
    date: "Jun 02, 2026",
    readTime: "10 min read",
    image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80"
    ],
    content: `<p><span class="dropcap">T</span>he internet was once a haven for personal expression, filled with detailed blogs and meandering journals. Today, much of that raw expression has been stylized, monetized, and condensed into rapid-fire social posts. The personal essay, however, resists this reduction, offering a refuge for complex thought and vulnerability.</p>`,
    reviews: [],
    comments: []
  },
  {
    id: "article-5",
    title: "Mapping the Neuro-Biology of Curiosity",
    subtitle: "Recent neurological studies reveal what happens in the brain when we seek new knowledge, showing that curiosity triggers our reward pathways.",
    category: "Science",
    author: {
      name: "Dr. Arthur Pendelton",
      role: "Science Contributor",
      avatar: "AP"
    },
    date: "Jun 01, 2026",
    readTime: "9 min read",
    image: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1532187643603-ba119ca4109e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=1200&q=80"
    ],
    content: `<p><span class="dropcap">C</span>uriosity is often described as a psychological drive, but its neural roots are deeply physical. Brain imaging shows that the anticipation of new information fires up the mesolimbic dopamine system—the same system associated with fundamental survival rewards. In essence, the human brain treats learning new things as a form of nourishment.</p>`,
    reviews: [],
    comments: []
  },
  {
    id: "article-6",
    title: "Why Boredom is the New Luxury Asset",
    subtitle: "In our hyper-connected, hyper-stimulated world, the rarest and most expensive state of mind is doing absolutely nothing.",
    category: "Opinion",
    author: {
      name: "Siena Hayes",
      role: "Social Anthropologist",
      avatar: "SH"
    },
    date: "May 30, 2026",
    readTime: "7 min read",
    image: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1528819622765-d6bfd0db0783?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80"
    ],
    content: `<p><span class="dropcap">T</span>he average modern adult checks their phone over a hundred times a day, filling every pocket of silence and waiting time with content. We have effectively eradicated boredom. But in doing so, we have also eliminated the fertile ground where creativity, self-reflection, and psychological recovery take root. True cognitive luxury is now the luxury of empty time.</p>`,
    reviews: [],
    comments: []
  }
];

window.INITIAL_ARTICLES = INITIAL_ARTICLES;
