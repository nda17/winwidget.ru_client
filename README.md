# WinWidget CRM Client

Отдельный frontend продукта **WinWidget CRM**. Репозиторий предназначен для
интерфейса `crm.winwidget.ru` и не содержит код основного сайта или Widgets.

## Текущий статус

Сейчас это только локальный технический bootstrap:

- продуктовые CRM-экраны и API-контракты ещё не реализованы;
- авторизация и общий вход с `winwidget.ru` ещё не подключены;
- production deploy, VPS, DNS, TLS и Nginx не настроены;
- push и production-релиз из этой ветки не выполняются.

Каноническая граница проекта:

```text
winwidget.ru_client
  основной сайт, кабинет Widgets и админка

winwidget.ru_client_crm
  frontend WinWidget CRM

winwidget.ru_services/apps/crm
  будущий автономный CRM backend
```

Нахождение CRM backend в сервисном монорепозитории не означает общий runtime:
он будет владеть собственной PostgreSQL, миграциями, ролями, health-check,
image и release lifecycle.

## Стек

- Node.js 20.17+;
- pnpm 9.15.9;
- Next.js 16, React 19 и TypeScript со `strict: true`;
- Tailwind CSS и Sass/SCSS Modules;
- React Query;
- Axios;
- Zustand;
- React Hook Form;
- react-hot-toast;
- ESLint, jsx-a11y, Prettier, Husky и lint-staged.

Chart.js, drag-and-drop, TipTap, QR, Sharp, auth-библиотеки и телефонная
нормализация не добавлены заранее. Они подключаются только вместе с функцией,
для которой действительно нужны.

## Локальный запуск

Требования:

- Node.js 20.17+;
- Corepack;
- локальный Gateway на `http://localhost:4100`, когда появятся API-вызовы.

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Приложение открывается на `http://localhost:3001`. Порт `3001` выбран, чтобы
не конфликтовать с основным frontend на `3000`.

## Переменные окружения

`.env.example` содержит только безопасные локальные значения и имена
переменных:

| Переменная            | Назначение                            |
| --------------------- | ------------------------------------- |
| `NEXT_PUBLIC_MODE`    | режим публичной frontend-конфигурации |
| `NEXT_PUBLIC_APP_URL` | origin CRM frontend                   |
| `NEXT_PUBLIC_API_URL` | публичный prefix API Gateway          |
| `APP_REVISION`        | безопасный идентификатор сборки       |

Секреты, приватные ключи, database URL и service credentials нельзя хранить в
этом frontend-репозитории или передавать через `NEXT_PUBLIC_*`.

## Команды

```bash
pnpm dev           # локальный сервер на 3001
pnpm build         # production Next.js build
pnpm start         # запуск готовой production-сборки
pnpm lint          # ESLint и accessibility rules
pnpm typecheck     # строгая TypeScript-проверка
pnpm format        # форматирование исходников и конфигурации
pnpm format:check  # проверка форматирования без записи
pnpm check         # полный локальный quality gate
```

Pre-commit hook запускает lint-staged только для добавленных в commit файлов.

## Локальный Docker

Dockerfile является основой для воспроизводимой локальной сборки на Node 20.
Production Compose и deploy workflow намеренно отсутствуют.

```bash
docker build -t winwidget-crm-client:local .
docker run --rm -p 3001:3000 winwidget-crm-client:local
```

После проверки локальный контейнер и образ нужно удалить согласно правилам
корневого `AGENTS.md`.

## Структура

Проект развивается по FSD-подходу основного frontend, но пустые слои заранее
не создаются:

```text
src/app       Next.js routes, layouts и providers
src/screens   композиция будущих CRM-экранов
src/features  пользовательские CRM-действия
src/entities  workspace, contact, deal, task и другие доменные модели
src/shared    API client, config, UI kit и общие библиотеки
```

Сейчас существует только `src/app`. Остальные слои появляются вместе с первым
вертикальным продуктовым срезом.

Стили пишутся через Tailwind `@apply`. Новые формы, списки и select должны
следовать общим frontend-паттернам WinWidget; пагинация всегда серверная.

## CI

Локально подготовлен только quality workflow:

1. frozen dependency install;
2. production dependency audit;
3. Prettier;
4. ESLint и accessibility;
5. TypeScript;
6. Next.js build;
7. воспроизводимая Docker-сборка.

Workflow не содержит SSH, production secrets, Compose или VPS deploy.

## Будущие integration gates

До подключения реальных CRM endpoint необходимо отдельно согласовать и
реализовать:

- Workspace/membership и CRM entitlement;
- точный Gateway prefix `/api/v1/crm`;
- CORS origin для локального `http://localhost:3001` и production
  `https://crm.winwidget.ru`;
- безопасный общий auth flow между `winwidget.ru` и `crm.winwidget.ru`;
- защиту от concurrent refresh race между вкладками и поддоменами;
- tenant-scoped React Query keys вида
  `['crm', workspaceId, resource, filters]`;
- fail-closed permissions и cross-workspace negative tests.

## Совместимость

Bootstrap не изменяет основной frontend, backend или Widgets. При дальнейшей
интеграции обязательна отдельно согласованная обратная совместимость:

- Widgets продолжают работать без покупки CRM;
- текущие страницы заявок и внешние интеграции сохраняются;
- CRM outage не влияет на public submit виджета;
- CRM подключается только явно и не импортирует историю автоматически;
- существующая Widget subscription не становится CRM entitlement.

## Ветки и релизы

Формат рабочих веток соответствует основному frontend:

```text
dev_X.Y.Z/feature/short-description
dev_X.Y.Z/fix/short-description
dev_X.Y.Z/chore/short-description
```

Текущая bootstrap-ветка:

```text
dev_2.5.0/chore/bootstrap-crm-client
```

Production branch, deploy contract и release workflow будут добавлены только
после отдельного согласования.
