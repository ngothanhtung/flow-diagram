import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpShell, Kbd, Pill, Section, Table } from '../ui';

export const metadata: Metadata = {
  title: 'Hướng dẫn sử dụng — X Flow Tool',
  description: 'Cách đăng nhập, tạo và chỉnh sửa sơ đồ, chạy hiệu ứng mô phỏng, lưu và chia sẻ sơ đồ trong X Flow Tool.',
};

const TOC = [
  ['start', 'Bắt đầu'],
  ['create', 'Tạo sơ đồ'],
  ['canvas', 'Thao tác trên canvas'],
  ['inspect', 'Chỉnh sửa khối & đường nối'],
  ['run', 'Chạy mô phỏng'],
  ['save', 'Lưu công việc'],
  ['share', 'Chia sẻ sơ đồ'],
  ['json', 'Xuất file & công cụ JSON'],
  ['reference', 'Tra cứu nhanh'],
] as const;

export default function HelpViPage() {
  return (
    <HelpShell
      title='Hướng dẫn sử dụng'
      tagline='Mọi thứ bạn cần để tạo, chạy hiệu ứng và chia sẻ sơ đồ luồng'
      languageSwitch={{ href: '/help', label: 'English' }}
      authoringGuideLabel='Hướng dẫn viết JSON'
      backLabel='Về danh sách sơ đồ'
      toc={TOC}
    >
      <p className='max-w-2xl text-sm leading-relaxed text-zinc-400'>
        X Flow Tool là trình soạn thảo sơ đồ luồng có hiệu ứng động chạy trên trình duyệt — kiến trúc hệ thống, quy trình nghiệp vụ, pipeline CI/CD. Trang này hướng dẫn quy trình làm việc
        hằng ngày. Nếu bạn cần quy tắc để tự viết (hoặc dùng AI viết) JSON của sơ đồ, hãy xem{' '}
        <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>hướng dẫn viết JSON</Link> (tiếng Anh).
      </p>

      <Section id='start' title='1. Bắt đầu'>
        <p>
          Đăng nhập bằng <strong>tài khoản Google</strong> hoặc <strong>email + mật khẩu</strong>. Mỗi sơ đồ bạn tạo thuộc về tài khoản của bạn và được lưu trên cloud — không ai khác mở hay
          sửa được, trừ khi bạn chủ động đặt nó ở chế độ công khai.
        </p>
        <p>
          Sau khi đăng nhập, bạn vào <strong>danh sách sơ đồ</strong>: bảng liệt kê mọi sơ đồ bạn sở hữu, kèm số khối/đường nối, trạng thái công khai, thời gian tạo và cập nhật. Tại đây bạn
          có thể:
        </p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>Bấm vào tên một sơ đồ để mở nó trong trình soạn thảo.</li>
          <li>Tìm kiếm theo tên hoặc id, sắp xếp theo bất kỳ cột nào, và phân trang khi danh sách dài.</li>
          <li>
            Dùng menu <Pill>⋯</Pill> ở cuối mỗi dòng để <strong>Edit</strong> (sửa), <strong>View</strong> (mở trang xem chỉ-đọc trong tab mới), <strong>Share</strong> (chia sẻ — chỉ với sơ đồ
            công khai) và <strong>Delete</strong> (xoá).
          </li>
        </ul>
      </Section>

      <Section id='create' title='2. Tạo sơ đồ'>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>New diagram</strong> — bắt đầu từ canvas trống.
          </li>
          <li>
            <strong>New from template</strong> — bắt đầu từ sơ đồ dựng sẵn (HRM, CRM, kiến trúc phần mềm, thương mại điện tử, CI/CD…). Template sau khi nạp vẫn chỉnh sửa được hoàn toàn: di
            chuyển và đổi kích thước khối, đổi hình dạng, nối lại các khối, đổi hiệu ứng đường nối.
          </li>
        </ul>
        <p>
          Cả hai nút nằm ở trang danh sách sơ đồ; trong trình soạn thảo, các lệnh tương tự nằm trong menu <strong>File</strong>. Để đổi tên sơ đồ, bấm vào tên nó trên thanh header, gõ tên mới
          rồi nhấn <Kbd>Enter</Kbd> (hoặc <Kbd>Esc</Kbd> để huỷ).
        </p>
      </Section>

      <Section id='canvas' title='3. Thao tác trên canvas'>
        <p>
          <strong>Thêm khối:</strong> chọn một hình từ thanh công cụ ở đáy canvas — dùng các nút vẽ nhanh (chữ nhật, bo góc, viên thuốc, thoi) hoặc mở lưới đầy đủ trong dropdown (lục giác,
          trụ, đám mây, tài liệu, ngôi sao…). Con trỏ chuyển thành dấu cộng; bấm-kéo trên canvas để vẽ khối với kích thước tuỳ ý. Công cụ tự tắt sau mỗi lần vẽ, nên hãy chọn lại hình cho khối
          tiếp theo. Nhấn <Kbd>Esc</Kbd> để huỷ công cụ đang chọn.
        </p>
        <p>
          <strong>Di chuyển &amp; đổi kích thước:</strong> kéo khối để di chuyển. Chọn khối trước để hiện bốn tay nắm ở góc, rồi kéo tay nắm để đổi kích thước.
        </p>
        <p>
          <strong>Nối các khối:</strong> rê chuột lên một khối để hiện các cổng kết nối, rồi kéo từ cổng sang khối khác. Một đường nối mờ chạy theo con trỏ, và cổng vào của khối đích sẽ nhấp
          nháy khi thả chuột sẽ tạo kết nối. Bạn cũng có thể kéo đầu mút của một đường nối sẵn có để gắn lại sang khối khác.
        </p>
        <p>
          <strong>Uốn đường nối:</strong> bấm đúp vào một đường đang chọn để thêm <em>điểm uốn</em> tại đó, kéo các điểm uốn để lượn đường tránh các khối khác, và bấm đúp vào một điểm uốn để
          xoá nó.
        </p>
        <p>
          <strong>Điều hướng:</strong> kéo vùng canvas trống để di chuyển khung nhìn (kéo bằng chuột giữa hoạt động ở mọi nơi), lăn chuột để thu phóng, và dùng cụm nút góc canvas để{' '}
          <em>Zoom in / Zoom out / Fit diagram to view</em>. Cụm điều khiển lưới bên cạnh dùng để bật/tắt bắt dính và chọn cỡ lưới.
        </p>
      </Section>

      <Section id='inspect' title='4. Chỉnh sửa khối & đường nối'>
        <p>
          Bấm vào một khối hoặc một đường nối sẽ mở <strong>bảng thuộc tính (inspector)</strong> bên phải — mọi tuỳ chỉnh giao diện nằm ở đó.
        </p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>Bảng thuộc tính khối:</strong> tiêu đề và mô tả, hình dạng, bảng màu hoặc màu tuỳ chỉnh, icon (bộ chọn có tìm kiếm với đầy đủ thư viện Lucide và Tabler), kích thước, phông
            chữ, xoay, cạnh kết nối (đường nối vào/ra ở cạnh nào), và thứ tự thực thi. Kèm hai nút <strong>Duplicate</strong> (nhân bản) và <strong>Delete</strong> (xoá).
          </li>
          <li>
            <strong>Bảng thuộc tính đường nối:</strong> nhãn, hiệu ứng động (comet, dots, pulse, wave, scanner, binary và hơn chục kiểu khác), kiểu đi dây (thẳng, cong, vuông góc,
            smooth-step), chiều chạy (xuôi / ngược / cả hai), mũi tên hai đầu, độ dày nét, cỡ vật thể hiệu ứng, hình dạng vật thể chạy trên đường nối (mũi tên, phong bì, đồng xu…), số lượng vật thể, mật độ hoạ tiết, độ sáng quầng neon, độ lệch pha và tốc độ chuyển động — cùng nút <strong>Delete</strong>.
          </li>
        </ul>
        <p>
          Mẹo: sơ đồ dễ đọc nhất khi dùng một họ hình dạng và một bảng màu nhỏ, nhất quán. <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>Hướng dẫn viết JSON</Link>{' '}
          liệt kê đầy đủ các quy ước hình ảnh mà những template dựng sẵn tuân theo.
        </p>
      </Section>

      <Section id='run' title='5. Chạy mô phỏng'>
        <p>
          Mọi sơ đồ đều có thể <em>chạy</em>: các khối lần lượt sáng lên và các đường nối tự vẽ theo thứ tự thực thi — rất hợp để thuyết trình một quy trình theo từng bước. Cụm điều khiển
          phát nằm trên thanh header của trình soạn thảo:
        </p>
        <Table
          head={['Nút', 'Tác dụng']}
          rows={[
            ['Sequential', 'Các bước tự chạy theo bộ đếm thời gian, mỗi lần một bước. Các khối có cùng thứ tự thực thi chạy cùng nhau trong một bước (nhánh song song).'],
            ['Concurrent', 'Mọi thứ chạy hiệu ứng cùng lúc — hữu ích để nhìn cả hệ thống "sống" một lượt.'],
            ['Manual', 'Không có gì tự chạy cho đến khi bạn bấm Next — bạn tự điều khiển từng bước, lý tưởng khi thuyết trình.'],
            ['Next', 'Chỉ trong chế độ Manual: chạy bước thực thi kế tiếp.'],
            ['Repeat', 'Chỉ trong chế độ Sequential: tự động chạy lại sau khi hoàn thành.'],
            ['Replay', 'Chạy lại hiệu ứng từ đầu, ở mọi chế độ.'],
          ]}
        />
        <p>
          Thứ tự chạy hiệu ứng lấy từ <strong>thứ tự thực thi</strong> của mỗi khối (đặt trong bảng thuộc tính khối). Các khối cùng số chạy trong cùng một bước — hãy tận dụng điều này để thể
          hiện các việc diễn ra song song.
        </p>
      </Section>

      <Section id='save' title='6. Lưu công việc'>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>Save</strong> (nút trên header) ghi sơ đồ lên cloud. Chấm vàng trên nút nghĩa là bạn còn thay đổi chưa lưu.
          </li>
          <li>
            <strong>Tự lưu phiên làm việc:</strong> các chỉnh sửa dở dang cũng được giữ tạm trong trình duyệt, nên lỡ tay tải lại trang hay đóng tab không làm mất việc — trình soạn thảo khôi
            phục đúng chỗ bạn dừng. Đây chỉ là lưới an toàn, không phải lưu cloud: hãy bấm <strong>Save</strong> để lưu thật sự.
          </li>
          <li>
            <strong>File → Save as</strong> nhân bản tài liệu hiện tại thành một sơ đồ hoàn toàn mới (&quot;… copy&quot;) và mở nó.
          </li>
          <li>
            <strong>File → Reset</strong> vứt bỏ mọi thay đổi chưa lưu và đưa canvas về trạng thái nạp gần nhất. Có hộp thoại xác nhận — thao tác này không hoàn tác được.
          </li>
        </ul>
      </Section>

      <Section id='share' title='7. Chia sẻ sơ đồ'>
        <p>Sơ đồ mặc định ở chế độ <strong>riêng tư (Private)</strong> — chỉ bạn (và quản trị viên) mở được. Để chia sẻ:</p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            Trên header trình soạn thảo, bấm nút chuyển <strong>Private / Public</strong> để đặt sơ đồ công khai, rồi lưu.
          </li>
          <li>
            Mở <strong>File → Share</strong> (hoặc lệnh <strong>Share</strong> trong menu dòng ở danh sách sơ đồ) và sao chép liên kết. Liên kết mở <strong>trang xem chỉ-đọc</strong> — người
            xem theo dõi được hiệu ứng nhưng không bao giờ sửa được; đặt công khai không cấp quyền sửa cho bất kỳ ai.
          </li>
          <li>Chuyển về <strong>Private</strong> bất cứ lúc nào để thu hồi liên kết.</li>
        </ul>
      </Section>

      <Section id='json' title='8. Xuất file & công cụ JSON'>
        <p>
          Bên dưới, mỗi sơ đồ là một tài liệu JSON duy nhất. <strong>File → Export to JSON</strong> tải nó về dưới dạng file <Pill>.json</Pill> — tiện để sao lưu, đưa vào version control,
          hoặc sửa tay.
        </p>
        <p>
          Nút <strong>Info</strong> trên cụm điều khiển canvas mở panel bên gồm phần tóm tắt tài liệu, khung JSON trực tiếp cập nhật theo từng chỉnh sửa, và JSON playground để dán một tài
          liệu vào canvas. Schema chi tiết từng trường được ghi trong <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>hướng dẫn viết JSON</Link>.
        </p>
      </Section>

      <Section id='reference' title='9. Tra cứu nhanh'>
        <Table
          head={['Thao tác', 'Cách làm']}
          rows={[
            ['Thêm khối', 'Chọn hình ở thanh công cụ đáy canvas, rồi bấm-kéo trên canvas'],
            ['Huỷ công cụ vẽ đang chọn', 'Esc, hoặc bấm lại vào công cụ đang bật'],
            ['Nối hai khối', 'Kéo từ cổng của khối này sang khối kia'],
            ['Uốn đường nối', 'Chọn đường, bấm đúp lên đường để thêm điểm uốn; kéo điểm uốn; bấm đúp vào điểm uốn để xoá'],
            ['Sửa khối / đường nối', 'Bấm vào nó — bảng thuộc tính mở bên phải'],
            ['Nhân bản hoặc xoá', 'Các nút ở đầu bảng thuộc tính'],
            ['Di chuyển khung nhìn', 'Kéo vùng canvas trống (hoặc kéo bằng chuột giữa ở mọi nơi)'],
            ['Thu phóng', 'Lăn chuột, hoặc các nút Zoom in / Zoom out / Fit'],
            ['Đổi tên sơ đồ', 'Bấm vào tên trên header, gõ, nhấn Enter'],
            ['Lưu lên cloud', 'Nút Save trên header (chấm vàng = còn thay đổi chưa lưu)'],
            ['Chạy hiệu ứng', 'Replay — chọn Sequential, Concurrent hoặc Manual trước'],
            ['Chia sẻ chỉ-đọc', 'Đặt sơ đồ Public, rồi File → Share → Copy'],
          ]}
        />
      </Section>
    </HelpShell>
  );
}
