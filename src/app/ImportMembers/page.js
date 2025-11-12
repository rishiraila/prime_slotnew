'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';

export default function UsersInfoPage() {
  const params = useParams();
  const eventId = params.id;

  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all members instead of event-specific members
      const response = await fetch('/api/members');
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setMembers(data.records || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      setMembers([]); // Clear members on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a file to import.');
      return;
    }

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/events/${eventId}/members/import`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      const { summary } = result;
      let alertMessage = `Import complete!\n\n`;
      alertMessage += `Total Rows: ${summary.totalRows}\n`;
      alertMessage += `New Members Created: ${summary.createdMembers}\n`;
      alertMessage += `Existing Members Updated: ${summary.updatedMembers}\n`;
      alertMessage += `Linked to Event: ${summary.linkedToEvent}\n`;
      alertMessage += `Already Linked: ${summary.alreadyLinked}\n`;
      if (summary.errors.length > 0) {
        alertMessage += `\nErrors: ${summary.errors.length}\n`;
        alertMessage += summary.errors.map(e => `  - Row ${e.index}: ${e.message}`).join('\n');
      }
      alert(alertMessage);

      await fetchMembers(); // Refresh the list
      document.getElementById('importMembersModal_close')?.click(); // Close modal
    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
      setFile(null);
    }
  };

  return (
    <div className="container-xxl flex-grow-1 container-p-y">
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="d-flex flex-wrap justify-content-between align-items-center">
            <h4 className="mb-0">Users Information</h4>
            <button
              className="btn btn-primary"
              type="button"
              data-bs-toggle="modal"
              data-bs-target="#importMembersModal"
            >
              <i className="ri-user-add-line me-1"></i> Import Members
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="card-title m-0">Members List</h5>
        </div>
        <div className="table-responsive text-nowrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Chapter</th>
                <th>Status</th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="table-border-bottom-0">
              {isLoading && <tr><td colSpan="7" className="text-center">Loading...</td></tr>}
              {!isLoading && members.length === 0 && <tr><td colSpan="7" className="text-center">No members found.</td></tr>}
              {!isLoading && members.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="d-flex align-items-center">
                      <div className="avatar avatar-sm me-3">
                        <Image src={user.avatar || '/assets/img/avatars/1.png'} alt="Avatar" width={32} height={32} className="rounded-circle" />
                      </div>
                      <div>
                        <h6 className="mb-0">{user.fullName}</h6>
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.mob}</td>
                  <td>{user.chaptername}</td>
                  <td>
                    <span className={`badge ${user.memberStatus === 'Active' ? 'bg-label-success' : user.memberStatus === 'Pending' ? 'bg-label-warning' : 'bg-label-danger'}`}>
                      {user.memberStatus}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex align-items-center">
                      <span className="fw-medium">{user.businessCategory}</span>
                      {user.businessman === 'Yes' && <i className="ri-briefcase-fill ri-14px text-primary ms-2" title="Businessman"></i>}
                    </div>
                  </td>
                  <td>
                    <div className="dropdown">
                      <button type="button" className="btn p-0 dropdown-toggle hide-arrow" data-bs-toggle="dropdown">
                        <i className="ri-more-2-line"></i>
                      </button>
                      <div className="dropdown-menu">
                        <a className="dropdown-item" href="#"><i className="ri-pencil-line me-1"></i> Edit</a>
                        <a className="dropdown-item" href="#"><i className="ri-delete-bin-7-line me-1"></i> Delete</a>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Members Modal */}
      <div className="modal fade" id="importMembersModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="modalCenterTitle">Import Members from Excel</h5>
              <button type="button" id="importMembersModal_close" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form onSubmit={handleImport}>
              <div className="modal-body">
                <p>Select an Excel file (.xlsx, .xls) to import members. The file should have columns for name, email, phone, chapter, status, and category.</p>
                <input className="form-control" type="file" onChange={handleFileChange} accept=".xlsx, .xls, .csv" required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-label-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isImporting}>
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}