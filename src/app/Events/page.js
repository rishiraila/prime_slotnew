'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

const API_URL = '/api/events';

const initialEventData = {
  title: '', // Changed from 'name' to 'title' to match API payload
  description: '',
  date: '',
  location: '',
  image: '/assets/img/pages/page-auth-register-dark.png',
};

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(initialEventData);
  const [isEditMode, setIsEditMode] = useState(false);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data.records || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      // You might want to set an error state here to show in the UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleOpenModal = (event = null) => {
    if (event) {
      setIsEditMode(true);
      setCurrentEvent({
        ...event,
        date: event.date ? new Date(event.date).toISOString().substring(0, 10) : '',
      });
    } else {
      setIsEditMode(false);
      setCurrentEvent(initialEventData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    // A trick to use Bootstrap's modal closing mechanism
    const closeButton = document.getElementById('addEventModal_close');
    if (closeButton) {
      closeButton.click();
    }
    setIsModalOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentEvent((prev) => ({ ...prev, [name]: value })); // This will correctly update 'title'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const url = isEditMode ? `${API_URL}/${currentEvent.id}` : API_URL;
    const method = isEditMode ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentEvent),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} event`);
      }

      await fetchEvents(); // Refresh the list
      handleCloseModal();
      alert(`Event ${isEditMode ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Save error:', error);
      alert(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${eventId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete event');
      }
      await fetchEvents(); // Refresh the list
      alert('Event deleted successfully.');
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Delete failed: ${error.message}`);
    }
  };

  return (
    <div className="container-xxl flex-grow-1 container-p-y">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Events</h4>
        <button className="btn btn-primary" type="button" onClick={() => handleOpenModal()} data-bs-toggle="modal" data-bs-target="#addEventModal">
          <i className="ri-add-line me-1"></i> Add Event
        </button>
      </div>

      {isLoading ? (
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center">
          <p>No events found. Click "Add Event" to create one.</p>
        </div>
      ) : (
        <div className="row g-4">
          {events.map((event) => (
            <div key={event.id} className="col-md-6 col-lg-4 d-flex">
              <div className="card h-100">
                {/* <Image className="card-img-top" src={event.image || '/assets/img/pages/page-auth-register-dark.png'} alt="Event Image" width={300} height={200} style={{ objectFit: 'cover' }} /> */}
                <div className="card-body">
                  <h5 className="card-title">{event.title}</h5>
                  <p className="card-text">{event.description}</p>
                </div>
                <div className="card-footer d-flex justify-content-between">
                  <div>
                    <small className="text-muted"><i className="ri-calendar-line me-1"></i>{new Date(event.date).toLocaleDateString()}</small>
                    <br />
                    <small className="text-muted"><i className="ri-map-pin-line me-1"></i>{event.location}</small>
                  </div>
                  <div className="dropdown">
                    <button type="button" className="btn p-0 dropdown-toggle hide-arrow" data-bs-toggle="dropdown">
                      <i className="ri-more-2-line"></i>
                    </button>
                    <div className="dropdown-menu dropdown-menu-end">
                      <a className="dropdown-item" href="#" onClick={() => handleOpenModal(event)} data-bs-toggle="modal" data-bs-target="#addEventModal">
                        <i className="ri-pencil-line me-1"></i> Edit
                      </a>
                      <a className="dropdown-item" href="#" onClick={() => handleDelete(event.id)}>
                        <i className="ri-delete-bin-7-line me-1"></i> Delete
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Event Modal */}
      <div className="modal fade" id="addEventModal" tabIndex="-1" aria-hidden={!isModalOpen}>
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{isEditMode ? 'Edit Event' : 'Add New Event'}</h5>
              <button
                type="button"
                id="addEventModal_close"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={() => setIsModalOpen(false)}
              ></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label htmlFor="title" className="form-label">Event Title</label>
                  <input
                    type="text"
                    id="title"
                    name="title" // Changed name attribute to 'title'
                    className="form-control"
                    placeholder="Enter event name"
                    value={currentEvent.title} // Updated to currentEvent.title
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="date" className="form-label">Date</label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    className="form-control"
                    value={currentEvent.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="location" className="form-label">Location</label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    className="form-control"
                    placeholder="Enter event location"
                    value={currentEvent.location}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="description" className="form-label">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    className="form-control"
                    rows="3"
                    placeholder="Enter event description"
                    value={currentEvent.description}
                    onChange={handleInputChange}
                  ></textarea>
                </div>
                <div className="mb-3">
                  <label htmlFor="status" className="form-label">Status</label>
                  <select
                    id="status"
                    name="status"
                    className="form-select"
                    value={currentEvent.status}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-label-secondary" data-bs-dismiss="modal" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}