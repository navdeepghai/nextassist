import os

import frappe


def extract_file_content(file_url: str) -> str:
	"""Extract text content from an uploaded file."""
	# Normalize and validate to prevent path traversal (e.g. ../../etc/passwd)
	clean_url = os.path.normpath(file_url.lstrip("/"))
	if ".." in clean_url or clean_url.startswith("/"):
		frappe.log_error(
			title="NextAssist: Path traversal attempt blocked",
			message=f"Suspicious file URL: {file_url}",
		)
		return ""

	site_path = os.path.realpath(frappe.get_site_path())

	file_path = frappe.get_site_path("public", clean_url)
	if not os.path.exists(file_path):
		# Try private files
		file_path = frappe.get_site_path(clean_url)

	# Final safety check: resolved path must stay within the site directory
	real_path = os.path.realpath(file_path)
	if not real_path.startswith(site_path + os.sep) and real_path != site_path:
		frappe.log_error(
			title="NextAssist: Path traversal attempt blocked",
			message=f"Resolved path {real_path} is outside site directory {site_path}",
		)
		return ""

	if not os.path.exists(file_path):
		return ""

	ext = os.path.splitext(file_path)[1].lower()

	try:
		if ext in (".txt", ".md", ".csv", ".log", ".json", ".xml", ".html", ".py", ".js", ".ts"):
			with open(file_path) as f:
				return f.read()

		elif ext == ".pdf":
			return _extract_pdf(file_path)

		elif ext in (".docx",):
			return _extract_docx(file_path)

		elif ext in (".xlsx", ".xls"):
			return _extract_spreadsheet(file_path)

		else:
			return f"[Unsupported file type: {ext}]"

	except Exception as e:
		return f"[Error extracting content: {e}]"


def _extract_pdf(file_path: str) -> str:
	from pypdf import PdfReader

	reader = PdfReader(file_path)
	text_parts = []
	for page in reader.pages:
		text = page.extract_text()
		if text:
			text_parts.append(text)
	return "\n\n".join(text_parts)


def _extract_docx(file_path: str) -> str:
	import xml.etree.ElementTree as ET
	import zipfile

	text_parts = []
	with zipfile.ZipFile(file_path) as z:
		with z.open("word/document.xml") as f:
			tree = ET.parse(f)
			for elem in tree.iter():
				if elem.text:
					text_parts.append(elem.text)
	return " ".join(text_parts)


def _extract_spreadsheet(file_path: str) -> str:
	import pandas as pd

	df = pd.read_excel(file_path, sheet_name=0)
	return df.to_string(index=False)
