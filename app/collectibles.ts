export const collectibles = [
  ["bell", "OLD BRASS SCHOOL BELL", "Found on Day 1"], ["pen", "FOUNTAIN PEN", "Found beneath the attendance book"], ["compass", "BRASS COMPASS", "Found in a shallow drawer"], ["ruler", "WOODEN RULER", "Found by the blackboard"], ["globe", "SMALL GLOBE", "Found in the map cabinet"], ["abacus", "RED-WOOD ABACUS", "Found near the window"], ["textbook", "OLD TEXTBOOK", "Found on a high shelf"], ["lens", "MAGNIFYING GLASS", "Found beside the ink"], ["puzzle", "WOODEN PUZZLE", "Found in the cupboard"], ["protractor", "BRASS PROTRACTOR", "Found in a paper sleeve"], ["watch", "POCKET WATCH", "Found behind the desk"], ["ink", "INK BOTTLE", "Found in the writing drawer"], ["slate", "SMALL SLATE", "Found under a stack of papers"], ["chalk", "CHALK BOX", "Found beneath the ledge"], ["key", "CABINET KEY", "Found in the coat pocket"], ["stamp", "LIBRARY STAMP", "Found in the card file"], ["map", "FOLDED STAR MAP", "Found in a blue envelope"], ["ledger", "LEATHER LEDGER", "Found under the globe"], ["eraser", "FELT ERASER", "Found near the board"], ["bookmark", "RIBBON BOOKMARK", "Found in an atlas"], ["top", "WOODEN TOP", "Found in the drawer"], ["clip", "BRASS PAPER CLIP", "Found on a note"], ["box", "MATCHBOX OF TACKS", "Found in the supply cabinet"], ["card", "INDEX CARD", "Found among old problems"], ["cube", "NUMBER CUBE", "Found beside the bell"], ["feather", "INK-STAINED FEATHER", "Found in a book"], ["shell", "SMALL SHELL", "Found on the sill"], ["coin", "OLD TOKEN", "Found under the rug"], ["tape", "MEASURING TAPE", "Found in a tin"], ["lamp", "LAMP PULL", "Found in the desk"],
] as const;

export type CollectibleId = typeof collectibles[number][0];
export const collectible = (id: string) => collectibles.find(([item]) => item === id) ?? collectibles[0];

export const objectGlyphs: Record<string, string> = {
  bell: "🔔", pen: "✒", compass: "⌖", ruler: "▰", globe: "◉", abacus: "▦",
  textbook: "▤", lens: "⌕", puzzle: "◇", protractor: "◡", watch: "◷", ink: "◆",
  slate: "▭", chalk: "▱", key: "⚿", stamp: "▣", map: "✧", ledger: "▥",
  eraser: "▬", bookmark: "▮", top: "♢", clip: "⌇", box: "▧", card: "▯",
  cube: "◈", feather: "⌁", shell: "◔", coin: "●", tape: "∿", lamp: "☼",
};
