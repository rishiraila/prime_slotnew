'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

const EVENTS_API_URL = '/api/events';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState({});
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(EVENTS_API_URL);
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data.records || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, []);

  const fetchMeetings = useCallback(async () => {
    if (!selectedEventId) {
      setMeetings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${EVENTS_API_URL}/${selectedEventId}/meetings`);
      if (!response.ok) throw new Error('Failed to fetch meetings');
      const data = await response.json();
      const meetingsData = data.records || [];

      // Fetch member details for attendees
      const memberIds = new Set();
      meetingsData.forEach(meeting => {
        memberIds.add(meeting.aId);
        memberIds.add(meeting.bId);
      });

      const memberPromises = Array.from(memberIds).map(async (id) => {
        const res = await fetch(`/api/members/${id}`);
        if (res.ok) {
          const memberData = await res.json();
          return { id, ...memberData };
        }
        return null;
      });

      const membersArray = await Promise.all(memberPromises);
      const membersMap = {};
      membersArray.forEach(member => {
        if (member) membersMap[member.id] = member;
      });

      setMembers(membersMap);

      // Transform meetings data to match the expected format
      const transformedMeetings = meetingsData.map(meeting => ({
        id: meeting.id,
        attendees: [
          {
            name: membersMap[meeting.aId]?.name || 'Unknown',
            avatar: '/assets/img/avatars/2.png' // Default avatar, can be customized
          },
          {
            name: membersMap[meeting.bId]?.name || 'Unknown',
            avatar: '/assets/img/avatars/3.png' // Default avatar, can be customized
          }
        ],
        date: new Date(meeting.scheduledAt).toISOString(),
        outcome: meeting.outcome || meeting.notes || 'No outcome recorded',
        referencesGiven: meeting.businessGivenByA || 0,
        referralsReceived: meeting.businessGivenByB || 0,
        status: meeting.status || 'scheduled'
      }));

      setMeetings(transformedMeetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-label-success';
      case 'Scheduled':
        return 'bg-label-info';
      case 'Canceled':
        return 'bg-label-danger';
      default:
        return 'bg-label-secondary';
    }
  };

  return (
    <div className="container-xxl flex-grow-1 container-p-y">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">
          <span className="text-muted fw-light">Dashboard /</span> Meetings
        </h4>
        <select
          className="form-select"
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          style={{ width: 'auto', minWidth: '200px' }}
        >
          <option value="">Select an Event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <h5 className="card-header">One-to-One Meetings</h5>
        <div className="table-responsive text-nowrap">
          <table className="table">
            <thead>
              <tr>
                <th>Attendees</th>
                <th>Date</th>
                <th>Outcome</th>
                <th>Business</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="table-border-bottom-0">
              {meetings.map((meeting) => (
                <tr key={meeting.id}>
                  <td>
                    <div className="d-flex align-items-center">
                      <div className="avatar-group">
                        {meeting.attendees.map((att, index) => (
                          <div key={index} className="avatar pull-up" title={att.name}>
                            <Image src={att.avatar} alt="Avatar" width={32} height={32} className="rounded-circle" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td>{new Date(meeting.date).toLocaleString()}</td>
                  <td><span className="text-truncate d-inline-block" style={{maxWidth: '250px'}}>{meeting.outcome}</span></td>
                  <td>
                    <div>Given: <span className="fw-medium">{meeting.referencesGiven}</span></div>
                    <div>Received: <span className="fw-medium">{meeting.referralsReceived}</span></div>
                  </td>
                  <td><span className={`badge ${getStatusBadge(meeting.status)}`}>{meeting.status}</span></td>
                  <td><a href="#" className="btn btn-sm btn-text-secondary"><i className="ri-more-2-line"></i></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
