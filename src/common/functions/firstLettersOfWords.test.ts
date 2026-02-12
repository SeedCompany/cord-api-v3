import { describe, expect, it } from '@jest/globals';
import { firstLettersOfWords } from './firstLettersOfWords';

describe('firstLettersOfWords', () => {
  it.each([
    // uppercase
    [`Ma'di South 2`, 'MS2'],
    [`2 Ma'di South`, '2MS'],
    [`Ruruuli-Runyala`, 'RR'],
    [`Ñandeva (Nandeva)`, 'ÑN'],
    [`Pame, Ñorthern`, 'PÑ'],
    [`Zapoteco de SBA`, 'ZS'],
    [`New-Est Cluster`, 'NEC'],
    [`Guina-ang Kalinga`, 'GK'],
    [`Fa d'Ambu NT`, 'FAN'],
    [`Aramaic M-South OT`, 'AMSO'],

    // lowercase
    [`ma'di south 2`, 'mds2'],
    [`ruruuli-runyala`, 'rr'],
    [`ñandeva (nandeva)`, 'ñn'],
    [`pame, northern`, 'pn'],
    [`zapoteco de sba`, 'zds'],
    [`new-est cluster`, 'nec'],
    [`guina-ang kalinga`, 'gak'],
    [`fa d'ambu nt`, 'fdan'],
    [`aramaic m-south ot`, 'amso'],
    [`ḛramaic 2 ḛouth`, 'ḛ2ḛ'],
    [`orgName`, 'o'],
  ])('%s -> %s', (words, letters) => {
    expect(firstLettersOfWords(words, Infinity)).toEqual(letters);
  });
});
