import type { CaseAsset } from '../lib/practicalCases';

const OSANEBI_MAP_SHA256 = '8bef666881a0b08dcb98ef5cda3d3c3e82d7d2fe121107ceba75a55ddb032ab7';

export default function PracticalCaseImage({ asset, enlarged = false }: {
  asset: CaseAsset & { url: string }; enlarged?: boolean;
}) {
  if (asset.sha256 === OSANEBI_MAP_SHA256) {
    // Rotate the original embedded PNG for reading; keep its bytes and hash intact.
    return <svg role="img" aria-label={asset.title} viewBox="0 0 1238 1263"
      className={`mx-auto block h-auto ${enlarged ? 'w-[900px] max-w-none' : 'w-full max-w-[520px]'}`}>
      <image href={asset.url} width="1263" height="1238" transform="translate(1238 0) rotate(90)" />
    </svg>;
  }
  return <img src={asset.url} alt={asset.title} className={enlarged ? 'h-auto max-w-none' : 'mx-auto h-auto max-w-full'} />;
}
