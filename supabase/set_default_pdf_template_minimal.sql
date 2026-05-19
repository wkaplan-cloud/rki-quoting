-- Change default PDF template for new signups to minimal
alter table settings alter column pdf_template set default 'minimal';
