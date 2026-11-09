# Project conventions
- Resolve reference and Pix images through `imageSources` and `ResolvedImage`, including legacy formats and signed URL renewal, so every view uses the same access path.
- Persist new reference and Pix uploads in Storage before saving their source to application records; keep legacy Data URLs readable and preserve existing access policies.