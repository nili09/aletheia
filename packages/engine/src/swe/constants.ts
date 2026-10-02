/** Constants from swephexp.h (Swiss Ephemeris 2.10.03). Values are the library's own. */

// Bodies (ipl)
export const SE_SUN = 0;
export const SE_MOON = 1;
export const SE_MERCURY = 2;
export const SE_VENUS = 3;
export const SE_MARS = 4;
export const SE_JUPITER = 5;
export const SE_SATURN = 6;
export const SE_MEAN_NODE = 10;
export const SE_TRUE_NODE = 11;
/** Pseudo-body: obliquity and nutation (xx[0] true obliquity, xx[1] mean, xx[2] dpsi, xx[3] deps). */
export const SE_ECL_NUT = -1;

// Calculation flags (iflag)
export const SEFLG_JPLEPH = 1;
export const SEFLG_SWIEPH = 2;
export const SEFLG_MOSEPH = 4;
export const SEFLG_EPHMASK = SEFLG_JPLEPH | SEFLG_SWIEPH | SEFLG_MOSEPH;
export const SEFLG_TRUEPOS = 16;
export const SEFLG_J2000 = 32;
export const SEFLG_NONUT = 64;
export const SEFLG_SPEED = 256;
export const SEFLG_NOGDEFL = 512;
export const SEFLG_NOABERR = 1024;
export const SEFLG_EQUATORIAL = 2 * 1024;
export const SEFLG_TOPOCTR = 32 * 1024;
export const SEFLG_SIDEREAL = 64 * 1024;
export const SEFLG_ICRS = 128 * 1024;
export const SEFLG_CENTER_BODY = 1024 * 1024;

// swe_julday / swe_revjul
export const SE_GREG_CAL = 1;

// Sidereal modes
export const SE_SIDM_LAHIRI = 1;
export const SE_NSIDM_PREDEF = 47;

// Eclipse type bits
export const SE_ECL_CENTRAL = 1;
export const SE_ECL_NONCENTRAL = 2;
export const SE_ECL_TOTAL = 4;
export const SE_ECL_ANNULAR = 8;
export const SE_ECL_PARTIAL = 16;
export const SE_ECL_ANNULAR_TOTAL = 32;
export const SE_ECL_PENUMBRAL = 64;
export const SE_ECL_ALLTYPES_SOLAR =
  SE_ECL_CENTRAL | SE_ECL_NONCENTRAL | SE_ECL_TOTAL | SE_ECL_ANNULAR | SE_ECL_PARTIAL | SE_ECL_ANNULAR_TOTAL;
export const SE_ECL_ALLTYPES_LUNAR = SE_ECL_TOTAL | SE_ECL_PARTIAL | SE_ECL_PENUMBRAL;

// Rise and set (rsmi)
export const SE_CALC_RISE = 1;
export const SE_CALC_SET = 2;
export const SE_BIT_DISC_CENTER = 256;
export const SE_BIT_GEOCTR_NO_ECL_LAT = 128;
export const SE_BIT_NO_REFRACTION = 512;
export const SE_BIT_HINDU_RISING = SE_BIT_DISC_CENTER | SE_BIT_NO_REFRACTION | SE_BIT_GEOCTR_NO_ECL_LAT;

// swe_azalt
export const SE_ECL2HOR = 0;

/** Return value of most functions on failure. */
export const ERR = -1;
/** swe_rise_trans: the body does not rise or set on that day (circumpolar). */
export const RISE_NONE = -2;

/** Buffer sizes from swephexp.h. */
export const AS_MAXCH = 256;
export const SE_MAX_STNAME = 256;
