import { expectTypeOf } from 'vitest';
import { asEpisodeId, asRunId, EpisodeId, RunId } from './ids.js';

describe('ID có thương hiệu', () => {
  it('phân biệt RunId và EpisodeId ở thời điểm biên dịch', () => {
    expectTypeOf<RunId>().not.toEqualTypeOf<EpisodeId>();
    expectTypeOf(asRunId('run-1')).toEqualTypeOf<RunId>();
    expectTypeOf(asEpisodeId('episode-1')).toEqualTypeOf<EpisodeId>();
  });
});
