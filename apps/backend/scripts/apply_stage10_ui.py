# !! Вспомогательный скрипт для аккуратного подключения блока вложений в страницы проекта и задачи (Этап 10)
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
PROJECT_PAGE = ROOT_DIR / "apps/frontend/src/pages/ProjectDetailsPage.tsx"
TASK_MODAL = ROOT_DIR / "apps/frontend/src/features/tasks/TaskDetailsModal.tsx"


def patch_project_details_page() -> None:
    if not PROJECT_PAGE.exists():
        print("Не найден файл:", PROJECT_PAGE)
        return

    text = PROJECT_PAGE.read_text(encoding="utf-8")
    if "AttachmentsSection" in text:
        print("ProjectDetailsPage.tsx уже содержит AttachmentsSection.")
        return

    import_line = (
        "// !! Подключён блок прикрепления и скачивания файлов проекта (Этап 10)\n"
        "import { AttachmentsSection } from '../features/attachments/AttachmentsSection';\n"
    )
    text = import_line + text

    idx = text.rfind("    </div>\n  );")
    if idx == -1:
        idx = text.rfind("  </div>\n  );")

    if idx != -1:
        snippet = (
            "\n      {/* !! Блок прикрепления и скачивания общих файлов проекта (Этап 10) */}\n"
            "      {project && (\n"
            "        <AttachmentsSection\n"
            "          projectId={project.id}\n"
            "          canUpload={project.myRole !== 'OBSERVER'}\n"
            "          isProjectLeader={project.myRole === 'LEADER'}\n"
            "        />\n"
            "      )}\n"
        )
        text = text[:idx] + snippet + text[idx:]
        PROJECT_PAGE.write_text(text, encoding="utf-8")
        print("Обновлён файл ProjectDetailsPage.tsx — добавлен блок файлов проекта.")
    else:
        print("Не удалось автоматически определить место вставки в ProjectDetailsPage.tsx.")


def patch_task_details_modal() -> None:
    if not TASK_MODAL.exists():
        print("Не найден файл:", TASK_MODAL)
        return

    text = TASK_MODAL.read_text(encoding="utf-8")
    if "AttachmentsSection" in text:
        print("TaskDetailsModal.tsx уже содержит AttachmentsSection.")
        return

    import_line = (
        "// !! Подключён блок прикрепления и скачивания файлов конкретной задачи (Этап 10)\n"
        "import { AttachmentsSection } from '../attachments/AttachmentsSection';\n"
    )
    text = import_line + text

    has_project_id_prop = bool(re.search(r"\bprojectId\b", text))
    proj_expr = "projectId" if has_project_id_prop else "task.projectId"
    can_edit_expr = (
        "canEdit"
        if re.search(r"\bcanEdit\b", text)
        else ("myRole !== 'OBSERVER'" if re.search(r"\bmyRole\b", text) else "true")
    )
    is_leader_expr = (
        "myRole === 'LEADER'" if re.search(r"\bmyRole\b", text) else "false"
    )

    comment_marker = re.search(r"\{\s*/\*.*Комментар.*\*/\s*\}", text)
    snippet = (
        "\n          {/* !! Блок прикрепления и скачивания файлов к задаче (Этап 10) */}\n"
        "          <AttachmentsSection\n"
        f"            projectId={{{proj_expr}}}\n"
        "            taskId={task.id}\n"
        f"            canUpload={{{can_edit_expr}}}\n"
        f"            isProjectLeader={{{is_leader_expr}}}\n"
        "          />\n\n          "
    )

    if comment_marker:
        pos = comment_marker.start()
        text = text[:pos] + snippet + text[pos:]
        TASK_MODAL.write_text(text, encoding="utf-8")
        print("Обновлён файл TaskDetailsModal.tsx — добавлен блок файлов задачи.")
    else:
        idx = text.rfind("        </div>\n      </div>")
        if idx != -1:
            text = text[:idx] + snippet + text[idx:]
            TASK_MODAL.write_text(text, encoding="utf-8")
            print("Обновлён файл TaskDetailsModal.tsx — добавлен блок файлов задачи.")
        else:
            print("Не удалось автоматически определить место вставки в TaskDetailsModal.tsx.")


if __name__ == "__main__":
    patch_project_details_page()
    patch_task_details_modal()
