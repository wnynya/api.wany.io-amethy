

DROP TABLE IF EXISTS `amethy_terminal_nodes`;
CREATE TABLE `amethy_terminal_nodes` (
  `uid` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hash` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `salt` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'bukkit',
  `creation` datetime NOT NULL,
  `lastused` datetime NOT NULL,
  `owner` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'offline',
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `serverinfo` longtext COLLATE utf8mb4_unicode_ci DEFAULT '{}',
  `serverstatus` longtext COLLATE utf8mb4_unicode_ci DEFAULT '{}',
  `logs` longtext COLLATE utf8mb4_unicode_ci DEFAULT '[]',
  `consolehistory` longtext COLLATE utf8mb4_unicode_ci DEFAULT '[]',
  `meta` longtext COLLATE utf8mb4_unicode_ci DEFAULT '{}',
  PRIMARY KEY (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

DELETE FROM `amethy_terminal_nodes`;