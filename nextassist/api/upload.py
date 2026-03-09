import frappe

from nextassist.ai.file_processor import extract_file_content
from nextassist.database import session_db

# Allowed file extensions for upload
_ALLOWED_EXTENSIONS = frozenset(
	{
		"txt",
		"md",
		"csv",
		"log",
		"json",
		"xml",
		"html",
		"py",
		"js",
		"ts",
		"pdf",
		"docx",
		"xlsx",
		"xls",
	}
)

# Max file size: 10 MB
_MAX_FILE_SIZE = 10 * 1024 * 1024


@frappe.whitelist()
def upload_file(session_id):
	"""Handle file upload for a chat session."""
	# Verify session ownership
	session = session_db.get_session(session_id)
	if not session:
		frappe.throw("Session not found.")
	if session["user_email"] != frappe.session.user:
		frappe.throw("You can only upload files to your own sessions.", frappe.PermissionError)

	files = frappe.request.files
	if not files:
		frappe.throw("No file uploaded")

	uploaded_file = next(iter(files.values()))

	# Validate file extension
	filename = uploaded_file.filename or ""
	ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
	if ext not in _ALLOWED_EXTENSIONS:
		frappe.throw(
			f"File type '.{ext}' is not allowed. Allowed types: {', '.join(sorted(_ALLOWED_EXTENSIONS))}"
		)

	# Read and validate file size
	content = uploaded_file.read()
	if len(content) > _MAX_FILE_SIZE:
		frappe.throw(f"File size exceeds the maximum limit of {_MAX_FILE_SIZE // (1024 * 1024)} MB")

	# Save file using Frappe's file handler (no DocType attachment — data lives in PG)
	file_doc = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": filename,
			"folder": "Home/Attachments",
			"content": content,
			"is_private": 1,
		}
	)
	file_doc.save(ignore_permissions=True)
	frappe.db.commit()

	# Extract content
	extracted = extract_file_content(file_doc.file_url)

	return {
		"file_url": file_doc.file_url,
		"file_name": file_doc.file_name,
		"file_type": file_doc.file_name.rsplit(".", 1)[-1] if "." in file_doc.file_name else "",
		"extracted_content": extracted[:5000] if extracted else "",
	}
