/**
 * Intelligence service for analytics and song recommendations.
 */
const recommendations = {
  "Gaye Holud": [
    { title: "Biyer Phool", mood: "Cinematic", note: "Trending Bengali Wedding Song" },
    { title: "Holud Bato Mehndi Bato", mood: "Traditional", note: "Classic for Gaye Holud" }
  ],
  "Mehendi": [
    { title: "Mehendi Hai Rachne Wali", mood: "Emotional", note: "Evergreen Mehendi Track" },
    { title: "London Thumakda", mood: "Dance", note: "High energy for rituals" }
  ],
  "Saat Paak": [
    { title: "Din Shagna Da", mood: "Emotional/Cinematic", note: "The go-to entry song" },
    { title: "Sajjan Bade Kanjoos", mood: "Fun", note: "Bengali twist for Saat Paak" }
  ]
};

function getRecommendations(ritualName) {
  return recommendations[ritualName] || [
    { title: "Shubho Bibaho", mood: "Cinematic", note: "Perfect for any wedding montage" }
  ];
}

function getSystemAnalytics(db) {
  const totalProjects = db.prepare("SELECT COUNT(*) as count FROM projects").get().count;
  const totalSongs = db.prepare("SELECT COUNT(*) as count FROM songs").get().count;
  const completedSongs = db.prepare("SELECT COUNT(*) as count FROM songs WHERE status = 'completed'").get().count;
  const failedSongs = db.prepare("SELECT COUNT(*) as count FROM songs WHERE status = 'failed'").get().count;
  
  const topRituals = db.prepare(`
    SELECT ritualName, COUNT(*) as count 
    FROM songs 
    GROUP BY ritualName 
    ORDER BY count DESC 
    LIMIT 5
  `).all();

  return {
    totalProjects,
    totalSongs,
    completedSongs,
    failedSongs,
    topRituals,
    healthStatus: "Optimal",
    uptime: process.uptime()
  };
}

module.exports = { getRecommendations, getSystemAnalytics };
