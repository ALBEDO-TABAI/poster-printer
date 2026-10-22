# Font credits

All bundled fonts are open-licensed (SIL Open Font License 1.1, Apache 2.0, or the Ubuntu Font Licence) and were subset to WOFF2 by `scripts/build-fonts.py`. Subsetting is a permitted modification; Reserved Font Names are not used for the subsets as product names. Upstream licence texts are in `licenses/fonts/`.

## Installed fonts (not bundled)

These fonts are free to download, but their licence does not allow passing the files on, so neither the repository nor the builds contain them. The app looks for a copy installed on the computer (`INSTALLED` in `src/lib/fonts.ts`, CSS `local()`); when it finds one, the family joins the font library. Exported SVGs refer to the installed font by name instead of embedding it, so they render in it only where it is installed.

| family | group | licence | download |
|---|---|---|---|
| Michelangelus | classic-serif | Microsoft Software License Terms (no distribution) | https://www.microsoft.com/en-us/download/details.aspx?id=108856 |

To use Michelangelus, download the zip from Microsoft, install the four `.ttf` files (macOS: double-click, or copy them to `~/Library/Fonts`), then restart the app or the browser.

## Bundled fonts

| family | group | licence | source |
|---|---|---|---|
| Abril Fatface | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Abril+Fatface |
| Albert Sans | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Albert+Sans |
| Alfa Slab One | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Alfa+Slab+One |
| Amatic SC | script | OFL-1.1 | https://fonts.google.com/specimen/Amatic+SC |
| Anton | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Anton |
| Anybody | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Anybody+Thin |
| Archivo | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Archivo+SemiBold |
| Archivo Black | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Archivo+Black |
| Archivo Narrow | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Archivo+Narrow |
| Audiowide | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Audiowide |
| Azeret Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/Azeret+Mono+Thin |
| Barlow | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Barlow |
| Barlow Condensed | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Barlow+Condensed |
| Basteleur Moonlight | experimental | OFL-1.1 | https://github.com/falsumit/Basteleur |
| Bebas Neue | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Bebas+Neue |
| Big Shoulders Display | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Big+Shoulders+Display+Thin |
| Big Shoulders Text | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Big+Shoulders+Text+Thin |
| Bitter | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Bitter+Thin |
| Black Ops One | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Black+Ops+One |
| Bluu Next | experimental | OFL-1.1 | https://github.com/velvetyne/BluuNext |
| Bodoni Moda | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Bodoni+Moda |
| Boeticher | experimental | OFL-1.1 | https://github.com/velvetyne/Boeticher |
| Bowlby One SC | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Bowlby+One+SC |
| Bricolage Grotesque | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Bricolage+Grotesque+96pt+ExtraBold |
| Brygada 1918 | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Brygada+1918 |
| Bungee | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Bungee |
| Bungee Shade | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Bungee+Shade |
| Caladea | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Caladea |
| Cardo | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Cardo |
| Caveat | script | OFL-1.1 | https://fonts.google.com/specimen/Caveat |
| Chivo | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Chivo+Medium |
| Cinzel | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Cinzel |
| Cinzel Decorative | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Cinzel+Decorative |
| Comfortaa | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Comfortaa |
| Cormorant | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Cormorant+Light |
| Cormorant Garamond | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Cormorant+Garamond+Light |
| Crimson Pro | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Crimson+Pro |
| DM Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/DM+Mono+Light |
| DM Sans | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/DM+Sans+9pt |
| DM Serif Display | display-serif | OFL-1.1 | https://fonts.google.com/specimen/DM+Serif+Display |
| DM Serif Text | display-serif | OFL-1.1 | https://fonts.google.com/specimen/DM+Serif+Text |
| Dancing Script | script | OFL-1.1 | https://fonts.google.com/specimen/Dancing+Script |
| Daubenton | experimental | OFL-1.1 | https://github.com/velvetyne/Daubenton |
| EB Garamond | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/EB+Garamond |
| Exo 2 | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Exo+2 |
| Familjen Grotesk | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Familjen+Grotesk |
| Fanwood | experimental | OFL-1.1 | https://github.com/theleagueof/fanwood |
| Figtree | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Figtree+Light |
| Fira Code | monospace | OFL-1.1 | https://fonts.google.com/specimen/Fira+Code+Light |
| Fjalla One | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Fjalla+One |
| Format_1452 | experimental | OFL-1.1 | https://github.com/velvetyne/Format_1452 |
| Fragment Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/Fragment+Mono |
| Francois One | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Francois+One |
| Fraunces | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Fraunces |
| Geist | swiss-sans | OFL-1.1 | https://github.com/vercel/geist-font |
| Geist Mono | monospace | OFL-1.1 | https://github.com/vercel/geist-font |
| Gentium Plus | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Gentium+Plus |
| Gloock | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Gloock |
| Goudy Bookletter 1911 | experimental | OFL-1.1 | https://github.com/theleagueof/goudy-bookletter-1911 |
| Great Vibes | script | OFL-1.1 | https://fonts.google.com/specimen/Great+Vibes |
| Hanken Grotesk | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Hanken+Grotesk |
| IBM Plex Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/IBM+Plex+Mono |
| IBM Plex Sans | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/IBM+Plex+Sans |
| IBM Plex Sans Condensed | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/IBM+Plex+Sans+Condensed |
| Ibarra Real Nova | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Ibarra+Real+Nova |
| Inconsolata | monospace | OFL-1.1 | https://fonts.google.com/specimen/Inconsolata |
| Indie Flower | script | OFL-1.1 | https://fonts.google.com/specimen/Indie+Flower |
| Instrument Sans | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Instrument+Sans |
| Instrument Serif | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Instrument+Serif |
| Inter | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Inter |
| Inter Tight | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Inter+Tight |
| JetBrains Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/JetBrains+Mono |
| Josefin Sans | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Josefin+Sans+Thin |
| Josefin Slab | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Josefin+Slab+Thin |
| Jost | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Jost |
| Junction | experimental | OFL-1.1 | https://github.com/theleagueof/junction |
| Kalam | script | OFL-1.1 | https://fonts.google.com/specimen/Kalam |
| Karla | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Karla |
| Knewave Outline | experimental | OFL-1.1 | https://github.com/theleagueof/knewave |
| LXGW WenKai | cjk | OFL-1.1 | https://github.com/lxgw/LxgwWenKai |
| League Gothic Condensed | condensed-display | OFL-1.1 | https://github.com/theleagueof/league-gothic |
| League Mono Condensed | experimental | OFL-1.1 | https://github.com/theleagueof/league-mono |
| League Spartan | experimental | OFL-1.1 | https://github.com/theleagueof/league-spartan |
| Lexend | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Lexend |
| Libre Baskerville | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Libre+Baskerville |
| Libre Caslon Display | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Libre+Caslon+Display |
| Libre Caslon Text | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Libre+Caslon+Text |
| Libre Franklin | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Libre+Franklin+Thin |
| Lilita One | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Lilita+One |
| Literata | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Literata |
| Liu Jian Mao Cao | cjk | OFL-1.1 | https://fonts.google.com/specimen/Liu+Jian+Mao+Cao |
| Long Cang | cjk | OFL-1.1 | https://fonts.google.com/specimen/Long+Cang |
| Lora | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Lora |
| Ma Shan Zheng | cjk | OFL-1.1 | https://fonts.google.com/specimen/Ma+Shan+Zheng |
| Manrope | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Manrope+ExtraLight |
| Martian Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/Martian+Mono+SemiExpanded |
| Maven Pro | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Maven+Pro |
| Merriweather | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Merriweather+Light |
| Montserrat | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Montserrat+Thin |
| Mourier | experimental | OFL-1.1 | https://github.com/velvetyne/Mourier |
| Mulish | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Mulish+ExtraLight |
| Newsreader | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Newsreader+16pt |
| Noto Sans | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Noto+Sans |
| Noto Sans Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/Noto+Sans+Mono |
| Noto Sans SC | cjk | OFL-1.1 | https://fonts.google.com/specimen/Noto+Sans+SC+Thin |
| Noto Serif | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Noto+Serif |
| Noto Serif SC | cjk | OFL-1.1 | https://fonts.google.com/specimen/Noto+Serif+SC+ExtraLight |
| Nunito Sans | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Nunito+Sans+12pt+ExtraLight |
| Onest | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Onest |
| Open Sans | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Open+Sans |
| Oranienbaum | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Oranienbaum |
| Orbitron | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Orbitron |
| Ostrich Sans | experimental | OFL-1.1 | https://github.com/theleagueof/ostrich-sans |
| Oswald | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Oswald |
| Outfit | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Outfit+Thin |
| PT Serif | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/PT+Serif |
| Pacifico | script | OFL-1.1 | https://fonts.google.com/specimen/Pacifico |
| Passion One | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Passion+One |
| Pathway Extreme | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Pathway+Extreme+8pt+Thin |
| Patrick Hand | script | OFL-1.1 | https://fonts.google.com/specimen/Patrick+Hand |
| Petrona | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Petrona |
| Playfair Display | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Playfair+Display |
| Plus Jakarta Sans | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Plus+Jakarta+Sans |
| Poppins | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Poppins |
| Prata | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Prata |
| Prociono | experimental | OFL-1.1 | https://github.com/theleagueof/prociono |
| Public Sans | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Public+Sans+Thin |
| Quicksand | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Quicksand+Light |
| Raleway | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Raleway+Thin |
| Red Hat Display | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Red+Hat+Display |
| Red Hat Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/Red+Hat+Mono |
| Red Hat Text | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Red+Hat+Text |
| Roboto | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Roboto |
| Roboto Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/Roboto+Mono |
| Roboto Slab | classic-serif | Apache 2.0 | https://fonts.google.com/specimen/Roboto+Slab |
| Rounded Mplus 1c | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Rounded+Mplus+1c |
| Rozha One | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Rozha+One |
| Rubik | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Rubik+Light |
| Rufina | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Rufina |
| Runic Sans Inline | experimental | OFL-1.1 | https://github.com/velvetyne/runic |
| Russo One | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Russo+One |
| Sacramento | script | OFL-1.1 | https://fonts.google.com/specimen/Sacramento |
| Saintjean | experimental | OFL-1.1 | https://github.com/velvetyne/saintjean |
| Saira Condensed | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Saira+Condensed |
| Saira ExtraCondensed | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Saira+ExtraCondensed |
| Schibsted Grotesk | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Schibsted+Grotesk |
| Shadows Into Light | script | OFL-1.1 | https://fonts.google.com/specimen/Shadows+Into+Light |
| Six Caps | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Six+Caps |
| Smiley Sans | cjk | OFL-1.1 | https://github.com/atelier-anchor/smiley-sans |
| Sora | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Sora |
| Source Code Pro | monospace | OFL-1.1 | https://fonts.google.com/specimen/Source+Code+Pro+ExtraLight |
| Source Han Sans CN | cjk | OFL-1.1 | https://github.com/adobe-fonts/source-han-sans |
| Source Han Serif CN | cjk | OFL-1.1 | https://github.com/adobe-fonts/source-han-serif |
| Source Sans 3 | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Source+Sans+3+ExtraLight |
| Source Serif 4 | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Source+Serif+4 |
| Space Grotesk | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Space+Grotesk+Light |
| Space Mono | monospace | OFL-1.1 | https://fonts.google.com/specimen/Space+Mono |
| Spectral | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Spectral |
| Sporting Grotesque | experimental | OFL-1.1 | https://github.com/velvetyne/Sporting-Grotesque |
| Staatliches | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Staatliches |
| Syne | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Syne |
| Teko | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Teko+Light |
| Terminal Grotesque | experimental | OFL-1.1 | https://github.com/StudioTriple/Terminal-Grotesque |
| Titillium Web | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Titillium+Web |
| Trickster | experimental | OFL-1.1 | https://github.com/velvetyne/Trickster |
| Typefesse | experimental | OFL-1.1 | https://github.com/velvetyne/Typefesse |
| Ubuntu Mono | monospace | Ubuntu Font License | https://fonts.google.com/specimen/Ubuntu+Mono |
| Ultra | display-serif | Apache 2.0 | https://fonts.google.com/specimen/Ultra |
| Unbounded | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Unbounded |
| Unna | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Unna |
| Urbanist | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Urbanist |
| VTF Victorianna | experimental | OFL-1.1 | https://github.com/velvetyne/Victorianna |
| Varela Round | geometric-sans | OFL-1.1 | https://fonts.google.com/specimen/Varela+Round |
| Work Sans | swiss-sans | OFL-1.1 | https://fonts.google.com/specimen/Work+Sans |
| Yanone Kaffeesatz | condensed-display | OFL-1.1 | https://fonts.google.com/specimen/Yanone+Kaffeesatz+ExtraLight |
| Yeseva One | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Yeseva+One |
| Young Serif | display-serif | OFL-1.1 | https://fonts.google.com/specimen/Young+Serif |
| ZCOOL KuaiLe | cjk | OFL-1.1 | https://fonts.google.com/specimen/ZCOOL+KuaiLe |
| ZCOOL QingKe HuangYou | cjk | OFL-1.1 | https://fonts.google.com/specimen/ZCOOL+QingKe+HuangYou |
| ZCOOL XiaoWei | cjk | OFL-1.1 | https://fonts.google.com/specimen/ZCOOL+XiaoWei |
| Zhi Mang Xing | cjk | OFL-1.1 | https://fonts.google.com/specimen/Zhi+Mang+Xing |
| Zilla Slab | classic-serif | OFL-1.1 | https://fonts.google.com/specimen/Zilla+Slab |

## Phase 11: modern Song / Hei, and the license check for the requested faces

**Added** (subset to GB2312 level 1 plus the characters used in the app, by `scripts/build-fonts.py`):
- **Chiron Sung HK (昭源宋體)** and **Chiron Hei HK (昭源黑體)**, both by Tamcy, both SIL OFL 1.1. They are based on Source Han Serif and Source Han Sans with modern stroke shapes. Each covers all 3,755 GB2312 level-1 characters. They follow Hong Kong glyph conventions, so a few components differ slightly from mainland forms. Sources: github.com/chiron-fonts/chiron-sung-hk, github.com/chiron-fonts/chiron-hei-hk (variable TTFs via github.com/google/fonts ofl/chironsunghk and ofl/chironheihk). The OFL texts are kept next to the sources in /workspace/fonts/cjk/chiron-*/OFL.txt.

**Checked and not bundled:**
- **水木明体 Mizuki-Ming:** IPA Font License 1.0, which is not OFL and is incompatible with it. Subsetting creates a derivative, and a derivative must be renamed and carry the IPA license.
- **MiSans (Xiaomi):** proprietary. Modification is prohibited (subsetting counts) and so is standalone redistribution.
- **HarmonyOS Sans (Huawei):** proprietary. Unmodified copies only, so subsetting is not allowed.
- **汇文明朝体 Huiwen-mincho:** a free custom license derived from Oradano. It is not OFL or CC0, so it is outside this project's rule.

**Not added:**
- **LXGW Neo ZhiSong:** IPA-derived.
- **Zhuque Fangsong:** OFL, but fangsong reads as semi-calligraphic.
- **GenRyuMin / GenWanMin:** OFL, but aimed at Traditional Chinese and Japanese.
- **Source Han Serif / Sans, Noto Serif / Sans SC, Smiley Sans:** these OFL faces were already bundled and remain the main faces.

**Use:** brush and calligraphy faces (Long Cang, Ma Shan Zheng, Zhi Mang Xing, Liu Jian Mao Cao) and the old-style display faces (ZCOOL XiaoWei, LXGW WenKai) remain bundled. Their styles are opt-in only (`OPT_IN_STYLES`): a random draw never uses them. Other styles that used them for display were moved to Chiron Sung, Chiron Hei or Noto Serif SC.
