import React from 'react';

export default function AssignmentDetailModal({ isOpen, onClose, assignment, onOpenDelegate }) {
  if (!isOpen || !assignment) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(11, 28, 48, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#FFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5EEFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F8F9FF'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: '#046A38',
              color: '#FFF',
              fontSize: '12px',
              fontWeight: 700
            }}>
              {assignment.penugasanId}
            </span>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0B1C30', margin: 0 }}>
                Rincian Penugasan & Alur Delegasi
              </h3>
              <span style={{ fontSize: '11.5px', color: '#6F7A6F' }}>
                Kategori: {assignment.kategori} • Fakultas Teknologi Informasi
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3F4940',
              backgroundColor: '#EFF4FF'
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Info Card */}
          <div style={{
            padding: '16px 18px',
            borderRadius: '12px',
            backgroundColor: '#EFF4FF',
            border: '1px solid #DCE9FF',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0B1C30' }}>
              {assignment.judul}
            </div>
            <div style={{ fontSize: '12.5px', color: '#3F4940', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong>Target Capaian:</strong> {assignment.target}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '6px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(220, 233, 255, 0.8)',
              fontSize: '12px'
            }}>
              <span><strong>Tenggat Waktu:</strong> {assignment.deadlineDisplay} ({assignment.relativeTime})</span>
              <span><strong>Prioritas:</strong> {assignment.prioritas}</span>
              <span><strong>Status:</strong> {assignment.status}</span>
            </div>
          </div>

          {/* Hierarchical Delegation Chain */}
          <div>
            <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0B1C30', marginBottom: '12px' }}>
              Rantai & Alur Delegasi Tugas
            </h4>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative',
              paddingLeft: '24px',
              borderLeft: '2px dashed #046A38',
              marginLeft: '12px'
            }}>
              {/* Level 1: Dekan */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '-31px',
                  top: '4px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '9999px',
                  backgroundColor: '#046A38',
                  border: '2px solid #FFF'
                }} />
                <div style={{ fontSize: '11px', color: '#6F7A6F', fontWeight: 600 }}>PEMBERI PENUGASAN UTAMA</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0B1C30' }}>
                  Prof. Dr. Ir. Ahmad Hidayat, M.T.
                </div>
                <div style={{ fontSize: '11.5px', color: '#004F28', fontWeight: 600 }}>
                  Dekan Fakultas Teknologi Informasi
                </div>
              </div>

              {/* Level 2: Pejabat Penerima Tugas */}
              <div style={{ position: 'relative', marginTop: '4px' }}>
                <div style={{
                  position: 'absolute',
                  left: '-31px',
                  top: '4px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '9999px',
                  backgroundColor: '#1338A8',
                  border: '2px solid #FFF'
                }} />
                <div style={{ fontSize: '11px', color: '#6F7A6F', fontWeight: 600 }}>PENERIMA PENUGASAN & KOORDINATOR</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0B1C30' }}>
                  {assignment.penerimaNama}
                </div>
                <div style={{ fontSize: '11.5px', color: '#1338A8', fontWeight: 600 }}>
                  {assignment.penerimaJabatan}
                </div>
              </div>

              {/* Level 3: Pelaksana / Sub-Delegasi */}
              <div style={{ position: 'relative', marginTop: '4px' }}>
                <div style={{
                  position: 'absolute',
                  left: '-31px',
                  top: '4px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '9999px',
                  backgroundColor: '#FE932C',
                  border: '2px solid #FFF'
                }} />
                <div style={{ fontSize: '11px', color: '#6F7A6F', fontWeight: 600 }}>TIM PELAKSANA / SUB-DELEGASI</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0B1C30' }}>
                  Staf Pengolah Data & Tim Pelaksana Unit Terkait
                </div>
                <div style={{ fontSize: '11.5px', color: '#6F7A6F' }}>
                  Status: Dalam Penyelesaian Logbook & Dokumen Pendukung
                </div>
              </div>
            </div>
          </div>

          {/* Ringkasan Logbook Terkait */}
          <div style={{
            padding: '14px 16px',
            borderRadius: '10px',
            backgroundColor: '#F8F9FF',
            border: '1px solid #E5EEFF'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0B1C30' }}>
                Logbook & Progres Penugasan
              </span>
              <span style={{ fontSize: '11px', color: '#004F28', fontWeight: 600 }}>
                Progress: 65% Terpenuhi
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#E5EEFF', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '65%', height: '100%', backgroundColor: '#046A38', borderRadius: '4px' }} />
            </div>
            <p style={{ fontSize: '11.5px', color: '#6F7A6F', marginTop: '8px' }}>
              3 entri logbook telah dikirimkan oleh tim pelaksana dan menunggu verifikasi akhir.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E5EEFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F8F9FF'
        }}>
          <button
            onClick={() => {
              onClose();
              onOpenDelegate(assignment);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#EFF4FF',
              color: '#046A38',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid #DCE9FF'
            }}
          >
            <span>⇄</span>
            <span>Delegasikan Ulang / Tambah Personel</span>
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              backgroundColor: '#046A38',
              color: '#FFF',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

