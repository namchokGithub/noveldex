import Link from 'next/link';
import { Character } from '../../../../types';
import { T } from '@/components/i18n/I18nProvider';

interface Props {
  characters: Character[];
  novelId: string;
}

export default function LinkedCharactersPanel({ characters, novelId }: Props) {
  if (characters.length === 0) {
    return <p className="text-sm text-gray-500"><T k="chapter.noLinkedCharacters" /></p>;
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
        <T k="chapter.characters" />
      </h2>
      <ul className="flex flex-wrap gap-2">
        {characters.map((char) => (
          <li key={char.id}>
            <Link
              href={`/novels/${novelId}/characters/${char.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-200 hover:bg-gray-700"
            >
              {char.name}
              <span className="text-xs text-gray-500">{char.role}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
