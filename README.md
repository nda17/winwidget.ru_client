# WinWidget CRM Client

Отдельный frontend продукта **WinWidget CRM**. Репозиторий предназначен для
интерфейса `crm.winwidget.ru` и не содержит код основного сайта или Widgets.

## Текущий статус

Сейчас реализован локальный contract-neutral frontend-фундамент:

- фирменные design tokens и базовый UI kit;
- адаптивный `AppShell` с sidebar, topbar и мобильной навигацией;
- каркасы разделов «Входящие», «Сделки», «Задачи», «Контакты»,
  «Аналитика» и «Настройки»;
- переиспользуемые таблица, readonly Kanban, drawer и поля форм;
- loading, empty, error, read-only и permission-denied состояния;
- только синтетические локальные fixtures без API, persistence и финальных DTO;
- авторизация и общий вход с `winwidget.ru` ещё не подключены;
- production deploy, VPS, DNS, TLS и Nginx не настроены;
- push и production-релиз из этой ветки не выполняются.

Каноническая граница проекта:

```text
winwidget.ru_client
  основной сайт, кабинет Widgets и админка

winwidget.ru_client_crm
  frontend WinWidget CRM

winwidget.ru_services/apps/crm-access
  CRM-роли, seats, teams и access projections

winwidget.ru_services/apps/crm-intake
  Inbox, источники, imports и acceptance process

winwidget.ru_services/apps/crm-customers
  контакты, компании, dedup/merge и PII lifecycle

winwidget.ru_services/apps/crm-sales
  сделки, воронки, задачи, сценарии и timeline
```

Нахождение CRM backend в сервисном монорепозитории не означает общий runtime:
каждое приложение `apps/crm-*` будет владеть собственной PostgreSQL, Prisma
schema, миграциями, ролями, Outbox, health-check, image и release lifecycle.
Вложенная папка `apps/crm`, общая CRM-БД и shared domain runtime не создаются.
После MVP новыми bounded contexts при подтверждённом спросе могут стать
`apps/crm-automation` и `apps/crm-communications`.

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
pnpm build         # production Next.js build через webpack
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
src/screens   композиция contract-neutral CRM-экранов и локальные fixtures
src/features  пользовательские CRM-действия
src/entities  workspace, contact, deal, task и другие доменные модели
src/shared    UI kit и общие библиотеки
src/widgets   AppShell и крупные самостоятельные UI-блоки
```

Слои `features` и `entities` намеренно не созданы: они появятся вместе с первым
согласованным API-контрактом и вертикальным продуктовым срезом.

Текущее направление зависимостей: `app → screens/widgets → shared`. Срезы
экспортируют публичный API через `index.ts`; обратные и cross-slice импорты не
используются.

Стили пишутся через Tailwind `@apply`. Новые формы, списки и select должны
следовать общим frontend-паттернам WinWidget; пагинация всегда серверная.

## Дизайн-направление

CRM сохраняет фирменную основу WinWidget: логотип, оранжевый акцент,
типографику, язык иконок, формы, кнопки, модальные окна, toast и радиусы. Сам
интерфейс проектируется как отдельное рабочее приложение, а не копия главной
страницы или кабинета Widgets:

- постоянный sidebar и компактная верхняя панель;
- плотные таблицы, Kanban, очереди задач и карточки сделок;
- drawer/split-view для быстрых действий без потери контекста;
- responsive web с приоритетом ежедневной desktop-работы менеджера;
- доступные loading, empty, error, read-only и permission states.

На первом этапе CRM UI kit остаётся в этом репозитории, чтобы frontend имел
независимые build и release lifecycle. Общие стабильные tokens и компоненты
можно позже вынести в версионированный package; runtime-import из основного
frontend не используется. Текущий bootstrap-экран не является финальным
дизайном CRM.

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
- единый Gateway prefix `/api/v1/crm/**` с точной маршрутизацией групп ресурсов
  на `crm-access`, `crm-intake`, `crm-customers`, `crm-sales` и существующий
  Reporting;
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

Текущая ветка UI-фундамента:

```text
dev_2.6.0/feature/crm-app-shell
```

Production branch, deploy contract и release workflow будут добавлены только
после отдельного согласования.
