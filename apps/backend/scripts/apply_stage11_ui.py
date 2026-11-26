# !! Вспомогательный скрипт для добавления кнопки «История изменений» рядом с «Метки проекта» и «Канбан-доска / Список» (Этап 11)
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
PROJECT_PAGE = ROOT_DIR / "apps/frontend/src/pages/ProjectDetailsPage.tsx"


def patch_project_details_page() -> None:
    if not PROJECT_PAGE.exists():
        print("Не найден файл:", PROJECT_PAGE)
        return

    text = PROJECT_PAGE.read_text(encoding="utf-8")
    if "ProjectActivityModal" in text:
        print("ProjectDetailsPage.tsx уже содержит кнопку и окно «История изменений».")
        return

    # 1. Добавляем импорт модального окна истории изменений
    import_line = (
        "// !! Подключено модальное окно подробной истории изменений (логов) проекта (Этап 11)\n"
        "import { ProjectActivityModal } from '../features/activity/ProjectActivityModal';\n"
    )
    text = import_line + text

    # Добавляем иконку History в импорт из lucide-react, если её ещё нет
    lucide_match = re.search(r"import\s*\{([^}]+)\}\s*from\s*'lucide-react';", text)
    if lucide_match and "History" not in lucide_match.group(1):
        icons_body = lucide_match.group(1).rstrip()
        new_lucide = f"import {{{icons_body},\n  History,\n}} from 'lucide-react';"
        text = text[: lucide_match.start()] + new_lucide + text[lucide_match.end() :]

    # 2. Добавляем состояние isActivityModalOpen внутрь компонента ProjectDetailsPage
    fn_match = re.search(r"export function ProjectDetailsPage\(\)\s*\{", text)
    if fn_match:
        state_snippet = (
            "\n  // !! Состояние открытия модального окна «История изменений» проекта (Этап 11)\n"
            "  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);\n"
        )
        text = text[: fn_match.end()] + state_snippet + text[fn_match.end() :]

    # 3. Ищем кнопку «Метки проекта» и вставляем сразу после неё кнопку «История изменений»
    labels_btn_match = re.search(
        r"(<button\b[^>]*>[\s\S]*?Метки проекта[\s\S]*?</button>)",
        text,
    )
    if not labels_btn_match:
        labels_btn_match = re.search(
            r"(<Button\b[^>]*>[\s\S]*?Метки проекта[\s\S]*?</Button>)",
            text,
        )

    history_button = (
        "\n              {/* !! Кнопка открытия подробной истории изменений проекта рядом с «Метки проекта» (Этап 11) */}\n"
        "              <button\n"
        "                type=\"button\"\n"
        "                onClick={() => setIsActivityModalOpen(true)}\n"
        "                className=\"inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50\"\n"
        "              >\n"
        "                <History className=\"h-3.5 w-3.5\" />\n"
        "                История изменений\n"
        "              </button>"
    )

    if labels_btn_match:
        insert_pos = labels_btn_match.end()
        text = text[:insert_pos] + history_button + text[insert_pos:]
        print("Кнопка «История изменений» добавлена рядом с «Метки проекта».")
    else:
        print("Внимание: не найдена кнопка «Метки проекта» по точному тексту, проверьте панель инструментов.")

    # 4. Рендерим модальное окно ProjectActivityModal перед закрывающим </div> страницы
    closing_idx = text.rfind("    </div>\n  );")
    if closing_idx == -1:
        closing_idx = text.rfind("  </div>\n  );")

    if closing_idx != -1:
        modal_snippet = (
            "\n      {/* !! Модальное окно журнала логов и изменений проекта (Этап 11) */}\n"
            "      {project && (\n"
            "        <ProjectActivityModal\n"
            "          projectId={project.id}\n"
            "          projectName={project.name}\n"
            "          isOpen={isActivityModalOpen}\n"
            "          onClose={() => setIsActivityModalOpen(false)}\n"
            "        />\n"
            "      )}\n"
        )
        text = text[:closing_idx] + modal_snippet + text[closing_idx:]
        PROJECT_PAGE.write_text(text, encoding="utf-8")
        print("Обновлён файл ProjectDetailsPage.tsx — подключено окно «История изменений».")
    else:
        PROJECT_PAGE.write_text(text, encoding="utf-8")
        print("Не удалось определить конец разметки ProjectDetailsPage.tsx для вставки модального окна.")


if __name__ == "__main__":
    patch_project_details_page()
