import { Link } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-12">
      <Card className="p-6 text-center">
        <p className="text-sm font-semibold text-slate-400">404</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Страница не найдена
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Запрошенный адрес не существует или был перемещён.
        </p>
        <div className="mt-5">
          <Link to="/">
            <Button>На главную</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
