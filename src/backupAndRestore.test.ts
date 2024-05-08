import {CompactScore, compressScores, decompressScores} from "./backupAndRestore.js";

test("Compress and Decompress", () => {
    const scores: CompactScore[] = [
        {u: "fsv", s: 142},
        {u: "pflurklurk", s: 9999},
    ];

    const compressed = compressScores(scores);
    const decompressed = decompressScores(compressed);

    expect(scores).toEqual(decompressed);
});
