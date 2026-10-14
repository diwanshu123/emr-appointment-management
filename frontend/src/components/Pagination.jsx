import { memo } from 'react';

function Pagination({ meta, onPageChange }) {
  if (!meta) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </span>
      <div>
        <button type="button" className="btn btn-small" disabled={!meta.hasPrev} onClick={() => onPageChange(meta.page - 1)}>
          Previous
        </button>
        <button type="button" className="btn btn-small" disabled={!meta.hasNext} onClick={() => onPageChange(meta.page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

export default memo(Pagination);
